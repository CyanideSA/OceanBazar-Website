import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../../utils/params';
import * as courierService from '../../services/courierService';
import * as pathaoService from '../../services/pathaoService';
import * as steadfastService from '../../services/steadfastService';
import { requireIdempotencyKey } from '../../middleware/idempotency';
import {
  assignCourierWithAudit,
  cancelCourierWithAudit,
  listCourierHealth,
} from '../../services/courierAdminService';
import type { AssignCourierInput } from '../../services/courierService';
import { notifyCustomer } from '../../services/customerNotify';
import { emitAdminEvent } from '../../lib/adminEvents';

const router = Router();

// GET /api/admin/delivery — list courier shipments
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { status, courier, search } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.internal_status = status;
  if (courier) where.courier_provider = courier;
  if (search) where.OR = [
    { order_id: { contains: search } },
    { consignment_id: { contains: search } },
    { tracking_code: { contains: search } },
    { recipient_name: { contains: search, mode: 'insensitive' } },
  ];

  const [shipments, total] = await Promise.all([
    prisma.courier_shipments.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.courier_shipments.count({ where }),
  ]);
  res.json({ shipments, total, page, limit });
});

// POST /api/admin/delivery/assign — assign courier to order
router.post('/assign', requireIdempotencyKey(), async (req: Request, res: Response) => {
  try {
    // #region agent log
    const body = req.body as AssignCourierInput;
    const _dbgAssign = { sessionId: '7c9155', runId: 'pathao-book', hypothesisId: 'A', location: 'delivery.ts:assign', message: 'assign courier request', data: { courier: body?.courier, orderId: body?.orderId, pathaoStoreId: (body as any)?.pathaoStoreId || null, pathaoCityId: (body as any)?.pathaoCityId || null, pathaoZoneId: (body as any)?.pathaoZoneId || null, pathaoAreaId: (body as any)?.pathaoAreaId || null }, timestamp: Date.now() };
    console.log('DBG7c9155', JSON.stringify(_dbgAssign));
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7c9155' }, body: JSON.stringify(_dbgAssign) }).catch(() => {});
    // #endregion
    const result = await assignCourierWithAudit(req, req.body as AssignCourierInput);
    if (!result.success) { res.status(400).json({ error: result.message }); return; }
    try {
      const order = await prisma.order.findUnique({ where: { id: (req.body as AssignCourierInput).orderId } });
      if (order) {
        await notifyCustomer({
          userId: order.userId,
          event: 'order_processing',
          vars: { orderNumber: order.orderNumber },
        });
      }
    } catch { /* non-fatal */ }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/delivery/manual — manual tracking entry fallback (no live courier API integration)
router.post('/manual', async (req: Request, res: Response) => {
  const { orderId, trackingCode, courierProvider, note } = req.body as {
    orderId: string; trackingCode: string; courierProvider?: string; note?: string;
  };
  if (!orderId || !String(trackingCode || '').trim()) {
    res.status(400).json({ error: 'orderId and trackingCode are required' });
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shippingAddress: true, user: true },
  });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  const recipientAddress = order.shippingAddress
    ? [order.shippingAddress.line1, order.shippingAddress.line2, order.shippingAddress.city, order.shippingAddress.district]
        .filter(Boolean).join(', ')
    : null;

  const shipment = await prisma.courier_shipments.create({
    data: {
      id: uuidv4(),
      order_id: orderId,
      courier_provider: (courierProvider || 'manual').toLowerCase(),
      tracking_code: trackingCode.trim(),
      courier_status: 'booked',
      internal_status: 'in_transit',
      recipient_name: order.user?.name || null,
      recipient_phone: order.user?.phone || null,
      recipient_address: recipientAddress,
      note: note || 'Manually booked via CRM',
    },
  });

  const trackingNumber = trackingCode.trim().slice(0, 16);
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'shipped', trackingNumber },
  });
  await prisma.orderTimeline.create({
    data: {
      orderId,
      status: 'shipped',
      note: `Manual tracking added: ${trackingCode.trim()}${courierProvider ? ` via ${courierProvider}` : ''}`,
      actorType: 'admin',
      actorId: String(req.admin!.adminId),
    },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'MANUAL_TRACKING_ADDED', targetType: 'order', targetId: orderId, details: { trackingCode, courierProvider } },
  });

  try {
    await notifyCustomer({
      userId: order.userId,
      event: 'delivery_update',
      vars: { orderNumber: order.orderNumber, status: 'shipped', trackingNumber: trackingCode.trim(), carrier: courierProvider || 'Manual' },
    });
  } catch { /* non-fatal */ }

  try { emitAdminEvent('admin:delivery:manual', { orderId, orderNumber: order.orderNumber, trackingCode: trackingCode.trim() }); } catch { /* non-fatal */ }

  res.status(201).json({ shipment, message: 'Manual tracking added' });
});

// GET /api/admin/delivery/track/:orderId — get tracking info
router.get('/track/:orderId', async (req: Request, res: Response) => {
  const result = await courierService.trackShipment(routeParam(req.params.orderId));
  res.json(result);
});

// POST /api/admin/delivery/cancel/:orderId — cancel courier shipment
router.post('/cancel/:orderId', requireIdempotencyKey(), async (req: Request, res: Response) => {
  const result = await cancelCourierWithAudit(req, routeParam(req.params.orderId));
  res.json(result);
});

router.get('/health/summary', async (_req: Request, res: Response) => {
  res.json(await listCourierHealth());
});

// GET /api/admin/delivery/couriers — list available couriers
router.get('/couriers', (_req: Request, res: Response) => {
  res.json({
    couriers: [
      { id: 'paperfly', name: 'Paperfly', active: true },
      { id: 'pathao', name: 'Pathao Courier', active: true },
      { id: 'steadfast', name: 'Steadfast Courier', active: true },
    ],
  });
});

// POST /api/admin/delivery/price-estimate
router.post('/price-estimate', async (req: Request, res: Response) => {
  const { courier, ...params } = req.body;
  const result = await courierService.getDeliveryPrice(courier, params);
  res.json(result);
});

// ─── Pathao geo proxies ──────────────────────────────────────────────────────

router.get('/pathao/cities', async (_req: Request, res: Response) => {
  try { res.json({ cities: await pathaoService.getCities() }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/pathao/zones/:cityId', async (req: Request, res: Response) => {
  try { res.json({ zones: await pathaoService.getZones(Number(req.params.cityId)) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/pathao/areas/:zoneId', async (req: Request, res: Response) => {
  try { res.json({ areas: await pathaoService.getAreas(Number(req.params.zoneId)) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/pathao/stores', async (_req: Request, res: Response) => {
  try { res.json({ stores: await pathaoService.getStores() }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Steadfast balance ───────────────────────────────────────────────────────

router.get('/steadfast/balance', async (_req: Request, res: Response) => {
  try { res.json(await steadfastService.getBalance()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/steadfast/payments', async (_req: Request, res: Response) => {
  try { res.json({ payments: await steadfastService.getPayments() }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/delivery/:id — single shipment detail joined with its order snapshot (must stay last — catch-all)
router.get('/:id', async (req: Request, res: Response) => {
  const cs = await prisma.courier_shipments.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!cs) { res.status(404).json({ error: 'Shipment not found' }); return; }
  const order = await prisma.order.findUnique({
    where: { id: cs.order_id },
    include: {
      items: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
      timeline: { orderBy: { createdAt: 'asc' } },
      shippingAddress: true,
      paymentTxs: true,
      shipments: true,
    },
  });
  res.json({ shipment: cs, order });
});

export default router;
