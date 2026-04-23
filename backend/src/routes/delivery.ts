import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { routeParam } from '../utils/params';

const router = Router();
const prisma = new PrismaClient();

// GET /api/delivery/track/:trackingNumber
router.get('/track/:trackingNumber', async (req: Request, res: Response) => {
  const shipment = await prisma.shipment.findFirst({
    where: { trackingNumber: routeParam(req.params.trackingNumber).toUpperCase() },
    include: { order: { select: { orderNumber: true, status: true, userId: true } } },
  });
  if (!shipment) { res.status(404).json({ error: 'Tracking number not found' }); return; }
  res.json({ shipment });
});

// GET /api/delivery/carriers — list supported BD carriers
router.get('/carriers', (_req, res: Response) => {
  res.json({
    carriers: [
      { id: 'pathao', name: 'Pathao Courier', website: 'https://pathao.com' },
      { id: 'steadfast', name: 'Steadfast Courier', website: 'https://steadfast.com.bd' },
      { id: 'redx', name: 'RedX', website: 'https://redx.com.bd' },
      { id: 'sundarban', name: 'Sundarban Courier', website: 'https://sundarbancourier.com' },
    ],
  });
});

// POST /api/delivery/webhook/:carrier — carrier webhook for status updates
router.post('/webhook/:carrier', async (req: Request, res: Response) => {
  const carrier = routeParam(req.params.carrier);
  const { trackingNumber, status, location, timestamp } = req.body as {
    trackingNumber: string;
    status: string;
    location?: string;
    timestamp?: string;
  };

  const shipment = await prisma.shipment.findFirst({
    where: { trackingNumber: (trackingNumber ?? '').toUpperCase(), carrier },
  });

  if (shipment) {
    const events = Array.isArray(shipment.events) ? shipment.events : [];
    const newEvent = { status, location, timestamp: timestamp ?? new Date().toISOString() };

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: mapCarrierStatus(status),
        events: [...(events as object[]), newEvent],
        updatedAt: new Date(),
      },
    });

    // Propagate to order status
    if (status === 'delivered') {
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: { status: 'delivered' },
      });
      await prisma.orderTimeline.create({
        data: {
          orderId: shipment.orderId,
          status: 'delivered',
          note: `Delivered via ${carrier}`,
          actorType: 'system',
        },
      });
    }
  }

  res.status(200).json({ received: true });
});

// ─── Customer-authenticated tracking ─────────────────────────────────────────

router.use(requireAuth);

router.get('/my-shipments', async (req: Request, res: Response) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.userId },
    select: { id: true, orderNumber: true, shipments: true },
  });
  res.json({ orders });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapCarrierStatus(s: string): 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' {
  const map: Record<string, 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned'> = {
    picked_up: 'picked_up',
    in_transit: 'in_transit',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
    returned: 'returned',
  };
  return map[s] ?? 'in_transit';
}

export default router;
