import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { mapPaperflyStatus } from '../services/paperflyService';
import { mapSteadfastStatus } from '../services/steadfastService';
import { sendShippingUpdate } from '../services/emailService';
import { sendShippingUpdateSms, sendShippingUpdateWhatsApp } from '../services/smsService';
import crypto from 'crypto';
import { emitToUser, emitToRoom } from '../lib/adminEvents';

const router = Router();
const prisma = new PrismaClient();
type CourierProvider = 'paperfly' | 'steadfast' | 'pathao' | 'redx';

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

function normalizeCourierProvider(raw: unknown): CourierProvider | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'paperfly' || value === 'steadfast' || value === 'pathao' || value === 'redx') return value;
  return null;
}

function detectCourierProvider(req: Request): CourierProvider | null {
  const body = req.body as Record<string, any>;
  const headerProvider = normalizeCourierProvider(req.headers['x-courier-provider'] ?? req.headers['x-webhook-provider']);
  const bodyProvider = normalizeCourierProvider(body?.provider ?? body?.courier_provider ?? body?.carrier);
  if (headerProvider) return headerProvider;
  if (bodyProvider) return bodyProvider;
  if (body?.order_status || body?.merchant_order_id) return 'pathao';
  if (body?.status && (body?.consignment_id || body?.tracking_code || body?.invoice)) return 'steadfast';
  if (body?.tracking_id && (body?.parcel_status || body?.status)) return 'redx';
  if (body?.event_type || body?.reference_number || body?.order_id || body?.data?.event_type) return 'paperfly';
  return null;
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
      sendShippingUpdateWhatsApp(order.user.phone, order.orderNumber, internalStatus, cs.tracking_code || undefined)
        .catch(e => console.error('[webhook] WhatsApp notify error:', e.message));
    }
  }

  if (order?.userId) {
    emitToUser(order.userId, 'delivery:update', {
      orderId: cs.order_id, orderNumber: order?.orderNumber,
      status: internalStatus, courier: courierProvider, timestamp: new Date().toISOString(),
    });
  }
  emitToRoom('admin:crm', 'delivery:update', {
    orderId: cs.order_id, orderNumber: order?.orderNumber,
    status: internalStatus, courier: courierProvider,
  });
}

async function handlePaperflyWebhook(req: Request, res: Response) {
  try {
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

    // Paperfly sends: { event: "parcel.delivered", data: { merchant_order_reference: "...", order_number: "..." } }
    const body = req.body as Record<string, any>;
    const eventType = String(body?.event || body?.event_type || 'unknown');
    const eventData = body?.data || {};
    // Use merchant_order_reference (our order number) OR Paperfly's own order_number
    const consignmentId = String(
      eventData?.merchant_order_reference ||
      eventData?.order_number ||
      body?.reference_number ||
      body?.order_id ||
      ''
    );

    if (consignmentId) {
      const internalStatus = mapPaperflyStatus(eventType);
      await processWebhookEvent('paperfly', consignmentId, eventType, internalStatus, req.body);
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[webhook/paperfly] Error:', err.message);
    res.status(200).json({ received: true });
  }
}

async function handleSteadfastWebhook(req: Request, res: Response) {
  const configuredToken = process.env.STEADFAST_WEBHOOK_TOKEN;
  if (!configuredToken) {
    res.status(503).json({ status: 'error', message: 'Steadfast webhook authentication is not configured.' });
    return;
  }

  const authorization = req.header('authorization') || '';
  const suppliedToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const expected = Buffer.from(configuredToken);
  const supplied = Buffer.from(suppliedToken);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    res.status(401).json({ status: 'error', message: 'Invalid webhook authorization.' });
    return;
  }

  try {
    const {
      consignment_id,
      tracking_code,
      invoice,
      status,
    } = req.body as {
      consignment_id?: string;
      tracking_code?: string;
      status?: string;
      invoice?: string;
    };

    const identifier = consignment_id || tracking_code || invoice;
    if (!identifier || !status) {
      res.status(400).json({ status: 'error', message: 'Invalid consignment ID or status.' });
      return;
    }

    const internalStatus = mapSteadfastStatus(status);
    let cs = await prisma.courier_shipments.findFirst({
      where: { consignment_id: String(identifier), courier_provider: 'steadfast' },
    });
    if (!cs && tracking_code) {
      cs = await prisma.courier_shipments.findFirst({
        where: { tracking_code, courier_provider: 'steadfast' },
      });
    }
    if (!cs && invoice) {
      const order = await prisma.order.findFirst({ where: { orderNumber: invoice } });
      if (order) {
        cs = await prisma.courier_shipments.findFirst({
          where: { order_id: order.id, courier_provider: 'steadfast' },
        });
      }
    }

    if (!cs) {
      res.status(400).json({ status: 'error', message: 'Invalid consignment ID.' });
      return;
    }

    await processWebhookEvent('steadfast', cs.consignment_id || String(identifier), status, internalStatus, req.body);
    res.status(200).json({ status: 'success', message: 'Webhook received successfully.' });
  } catch (err: any) {
    console.error('[webhook/steadfast] Error:', err.message);
    res.status(500).json({ status: 'error', message: 'Webhook processing failed.' });
  }
}

async function handlePathaoWebhook(req: Request, res: Response) {
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
}

async function handleRedxWebhook(req: Request, res: Response) {
  try {
    const body = req.body as Record<string, any>;
    const trackingId = String(body?.tracking_id ?? body?.parcel?.tracking_id ?? '');
    const status = String(body?.parcel_status ?? body?.status ?? body?.parcel?.status ?? '');

    if (trackingId && status) {
      const { mapRedxStatus } = await import('../services/redxService');
      const internalStatus = mapRedxStatus(status);

      let cs = await prisma.courier_shipments.findFirst({
        where: { consignment_id: trackingId, courier_provider: 'redx' },
      });
      if (!cs) {
        cs = await prisma.courier_shipments.findFirst({
          where: { tracking_code: trackingId, courier_provider: 'redx' },
        });
      }

      if (cs) {
        await processWebhookEvent('redx', cs.consignment_id || trackingId, status, internalStatus, req.body);
      } else {
        console.warn(`[webhook/redx] No shipment found for tracking_id=${trackingId}`);
      }
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[webhook/redx] Error:', err.message);
    res.status(200).json({ received: true });
  }
}

// ─── Paperfly Webhook ────────────────────────────────────────────────────────

router.post('/paperfly', handlePaperflyWebhook);

// ─── Steadfast Webhook ───────────────────────────────────────────────────────

router.post('/steadfast', handleSteadfastWebhook);

// ─── Pathao Webhook ─────────────────────────────────────────────────────────

router.post('/pathao', handlePathaoWebhook);

// ─── RedX Webhook ──────────────────────────────────────────────────────────

router.post('/redx', handleRedxWebhook);

// ─── Unified courier webhook ────────────────────────────────────────────────

router.post('/courier', async (req: Request, res: Response) => {
  const provider = detectCourierProvider(req);
  if (!provider) {
    res.status(400).json({ error: 'Unable to detect courier provider' });
    return;
  }

  switch (provider) {
    case 'paperfly':
      await handlePaperflyWebhook(req, res);
      return;
    case 'steadfast':
      await handleSteadfastWebhook(req, res);
      return;
    case 'pathao':
      await handlePathaoWebhook(req, res);
      return;
    case 'redx':
      await handleRedxWebhook(req, res);
      return;
    default:
      res.status(400).json({ error: 'Unsupported courier provider' });
  }
});

// ─── Generic webhook (future carriers) ──────────────────────────────────────

router.post('/:carrier', async (req: Request, res: Response) => {
  console.log(`[webhook] Received event from carrier: ${req.params.carrier}`, JSON.stringify(req.body).slice(0, 500));
  res.status(200).json({ received: true });
});

export default router;
