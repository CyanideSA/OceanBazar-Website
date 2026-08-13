import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { requireAuth } from '../middleware/auth';
import { routeParam } from '../utils/params';
import {
  getAreas,
  getPickupStores,
  getPickupStoreDetails,
  calculateParcelCharge,
} from '../services/redxService';
import { estimateCartWeightKg, quotePathaoDelivery } from '../services/deliveryQuoteService';

const router = Router();

// ─── RedX Area Lookup (public) ────────────────────────────────────────────────
// GET /api/delivery/redx/areas?post_code=1207
// GET /api/delivery/redx/areas?district_name=Dhaka

router.get('/redx/areas', async (req: Request, res: Response) => {
  const areas = await getAreas({
    postCode: req.query.post_code ? Number(req.query.post_code) : undefined,
    districtName: req.query.district_name as string | undefined,
  });
  res.json({ areas });
});

// ─── RedX Charge Calculator (public) ─────────────────────────────────────────
// GET /api/delivery/redx/charge?delivery_area_id=12&pickup_area_id=1&cash_collection_amount=500&weight=300

router.get('/redx/charge', async (req: Request, res: Response) => {
  const { delivery_area_id, pickup_area_id, cash_collection_amount, weight } = req.query;
  if (!delivery_area_id || !pickup_area_id || !cash_collection_amount || !weight) {
    res.status(400).json({ error: 'delivery_area_id, pickup_area_id, cash_collection_amount, weight required' });
    return;
  }
  const result = await calculateParcelCharge({
    delivery_area_id: Number(delivery_area_id),
    pickup_area_id: Number(pickup_area_id),
    cash_collection_amount: Number(cash_collection_amount),
    weight: Number(weight),
  });
  if (!result) { res.status(502).json({ error: 'Could not calculate charge' }); return; }
  res.json(result);
});

// ─── RedX Pickup Stores (public) ─────────────────────────────────────────────

router.get('/redx/pickup-stores', async (_req: Request, res: Response) => {
  const stores = await getPickupStores();
  res.json({ pickup_stores: stores });
});

router.get('/redx/pickup-stores/:id', async (req: Request, res: Response) => {
  const store = await getPickupStoreDetails(Number(routeParam(req.params.id)));
  if (!store) { res.status(404).json({ error: 'Pickup store not found' }); return; }
  res.json({ pickup_store: store });
});

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

// POST /api/delivery/pathao/quote — live courier fee for checkout
router.post('/pathao/quote', async (req: Request, res: Response) => {
  const shippingAddressId = Number(req.body?.shippingAddressId);
  const itemCount = Number(req.body?.itemCount) || 1;
  if (!Number.isFinite(shippingAddressId) || shippingAddressId <= 0) {
    res.status(400).json({ error: 'shippingAddressId is required' });
    return;
  }

  const address = await prisma.savedAddress.findFirst({
    where: { id: shippingAddressId, userId: req.user!.userId },
  });
  if (!address) {
    res.status(404).json({ error: 'Address not found' });
    return;
  }

  const pathaoCityId = Number((address as { pathaoCityId?: number | null }).pathaoCityId) || 0;
  const pathaoZoneId = Number((address as { pathaoZoneId?: number | null }).pathaoZoneId) || 0;
  if (!pathaoCityId || !pathaoZoneId) {
    res.status(400).json({
      error: 'Update address with Pathao city and zone to get delivery charge',
    });
    return;
  }

  try {
    const quote = await quotePathaoDelivery({
      pathaoCityId,
      pathaoZoneId,
      itemWeightKg: estimateCartWeightKg(itemCount),
    });
    res.json({ quote: { price: quote.price, provider: quote.provider, discount: quote.discount } });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Could not load courier delivery charge' });
  }
});

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
