import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { mapPaperflyStatus } from '../services/paperflyService';
import { mapSteadfastStatus } from '../services/steadfastService';
import { sendShippingUpdate } from '../services/emailService';
import { sendShippingUpdateSms } from '../services/smsService';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapToOrderStatus(internalStatus: string): string | null {
  const map: Record<string, string> = {
    pending: 'processing',
    picked_up: 'shipped',
    in_transit: 'shipped',
    out_for_delivery: 'shipped',
    delivered: 'delivered',
    returned: 'returned',
    cancelled: 'cancelled',
  };
  return map[internalStatus] || null;
}

async function processWebhookEvent(
  courierProvider: string,
  consignmentId: string,
  eventType: string,
  internalStatus: string,
  rawPayload: any
) {
  const cs = await prisma.courier_shipments.findFirst({
    where: { consignment_id: consignmentId, courier_provider: courierProvider },
  });
  if (!cs) {
    console.warn(`[webhook] No courier_shipment found for ${courierProvider}:${consignmentId}`);
    return;
  }

  // Append to webhook_events
  const existingEvents = Array.isArray(cs.webhook_events) ? cs.webhook_events : [];
  const newEvent = { eventType, internalStatus, timestamp: new Date().toISOString(), raw: rawPayload };

  await prisma.courier_shipments.update({
    where: { id: cs.id },
    data: {
      courier_status: eventType,
      internal_status: internalStatus,
      webhook_events: [...(existingEvents as object[]), newEvent],
      updated_at: new Date(),
    },
  });

  // Update Shipment (legacy) table
  const shipment = await prisma.shipment.findFirst({ where: { orderId: cs.order_id, carrier: courierProvider } });
  if (shipment) {
    const events = Array.isArray(shipment.events) ? shipment.events : [];
    const statusMap: Record<string, 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned'> = {
      pending: 'pending', picked_up: 'picked_up', in_transit: 'in_transit',
      out_for_delivery: 'out_for_delivery', delivered: 'delivered', returned: 'returned',
    };
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: statusMap[internalStatus] || 'in_transit',
        events: [...(events as object[]), { status: internalStatus, timestamp: new Date().toISOString() }],
      },
    });
  }

  // Update order status
  const orderStatus = mapToOrderStatus(internalStatus);
  if (orderStatus) {
    await prisma.order.update({
      where: { id: cs.order_id },
      data: { status: orderStatus },
    });
    await prisma.orderTimeline.create({
      data: {
        orderId: cs.order_id,
        status: orderStatus,
        note: `${courierProvider}: ${eventType} → ${internalStatus}`,
        actorType: 'system',
      },
    });
  }

  // Send notifications to customer
  const order = await prisma.order.findUnique({
    where: { id: cs.order_id },
    include: { user: { select: { email: true, phone: true } } },
  });
  if (order) {
    if (order.user.email) {
      sendShippingUpdate(order.user.email, order.orderNumber, internalStatus, cs.tracking_code || undefined, courierProvider)
        .catch(e => console.error('[webhook] Email notify error:', e.message));
    }
    if (order.user.phone) {
      sendShippingUpdateSms(order.user.phone, order.orderNumber, internalStatus, cs.tracking_code || undefined)
        .catch(e => console.error('[webhook] SMS notify error:', e.message));
    }
  }

  // Emit Socket.io event (import io lazily to avoid circular deps)
  try {
    const { io } = await import('../app');
    io.to(`user:${order?.userId}`).emit('delivery:update', {
      orderId: cs.order_id,
      orderNumber: order?.orderNumber,
      status: internalStatus,
      courier: courierProvider,
      timestamp: new Date().toISOString(),
    });
    io.to('admin:chat').emit('delivery:update', {
      orderId: cs.order_id,
      orderNumber: order?.orderNumber,
      status: internalStatus,
      courier: courierProvider,
    });
  } catch { /* socket emit failure is non-fatal */ }
}

// ─── Paperfly Webhook ────────────────────────────────────────────────────────

router.post('/paperfly', async (req: Request, res: Response) => {
  try {
    // Optional signature validation
    const webhookSecret = process.env.PAPERFLY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-paperfly-signature'] as string;
      if (signature) {
        const expected = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(req.body)).digest('hex');
        if (signature !== expected) {
          console.warn('[webhook/paperfly] Invalid signature');
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }
    }

    const { event_type, reference_number, order_id, data: eventData } = req.body as {
      event_type?: string;
      reference_number?: string;
      order_id?: string;
      data?: any;
    };

    const consignmentId = reference_number || order_id || eventData?.reference_number;
    const eventType = event_type || eventData?.event_type || 'unknown';

    if (consignmentId) {
      const internalStatus = mapPaperflyStatus(eventType);
      await processWebhookEvent('paperfly', consignmentId, eventType, internalStatus, req.body);
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[webhook/paperfly] Error:', err.message);
    res.status(200).json({ received: true }); // Always 200 to prevent retries
  }
});

// ─── Steadfast Webhook ───────────────────────────────────────────────────────

router.post('/steadfast', async (req: Request, res: Response) => {
  try {
    const {
      consignment_id,
      tracking_code,
      status,
      invoice,
    } = req.body as {
      consignment_id?: string;
      tracking_code?: string;
      status?: string;
      invoice?: string;
    };

    const identifier = consignment_id || tracking_code;
    if (identifier && status) {
      const internalStatus = mapSteadfastStatus(status);

      // Try finding by consignment_id first, then tracking_code
      let cs = await prisma.courier_shipments.findFirst({
        where: { consignment_id: String(identifier), courier_provider: 'steadfast' },
      });
      if (!cs && tracking_code) {
        cs = await prisma.courier_shipments.findFirst({
          where: { tracking_code, courier_provider: 'steadfast' },
        });
      }

      if (cs) {
        await processWebhookEvent('steadfast', cs.consignment_id || String(identifier), status, internalStatus, req.body);
      }
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[webhook/steadfast] Error:', err.message);
    res.status(200).json({ received: true });
  }
});

// ─── Pathao Webhook ─────────────────────────────────────────────────────────

router.post('/pathao', async (req: Request, res: Response) => {
  try {
    const {
      consignment_id,
      order_status,
      merchant_order_id,
    } = req.body as {
      consignment_id?: string;
      order_status?: string;
      merchant_order_id?: string;
    };

    const identifier = String(consignment_id || merchant_order_id || '');
    if (identifier && order_status) {
      const { mapPathaoStatus } = await import('../services/pathaoService');
      const internalStatus = mapPathaoStatus(order_status);

      let cs = await prisma.courier_shipments.findFirst({
        where: { consignment_id: identifier, courier_provider: 'pathao' },
      });
      if (!cs && merchant_order_id) {
        // Try matching via order number
        const order = await prisma.order.findFirst({ where: { orderNumber: merchant_order_id } });
        if (order) {
          cs = await prisma.courier_shipments.findFirst({
            where: { order_id: order.id, courier_provider: 'pathao' },
          });
        }
      }

      if (cs) {
        await processWebhookEvent('pathao', cs.consignment_id || identifier, order_status, internalStatus, req.body);
      }
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[webhook/pathao] Error:', err.message);
    res.status(200).json({ received: true });
  }
});

// ─── Generic webhook (future carriers) ──────────────────────────────────────

router.post('/:carrier', async (req: Request, res: Response) => {
  console.log(`[webhook] Received event from carrier: ${req.params.carrier}`, JSON.stringify(req.body).slice(0, 500));
  res.status(200).json({ received: true });
});

export default router;
