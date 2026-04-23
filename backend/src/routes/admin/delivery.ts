import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { routeParam } from '../../utils/params';
import * as courierService from '../../services/courierService';
import * as pathaoService from '../../services/pathaoService';
import * as steadfastService from '../../services/steadfastService';

const router = Router();
const prisma = new PrismaClient();

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
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const result = await courierService.assignCourier(req.body);
    if (!result.success) { res.status(400).json({ error: result.message }); return; }

    await prisma.auditLog.create({
      data: {
        adminId: req.admin!.adminId,
        action: 'ASSIGN_COURIER',
        targetType: 'order',
        targetId: req.body.orderId,
        details: { courier: req.body.courier, consignmentId: result.consignmentId },
      },
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/delivery/track/:orderId — get tracking info
router.get('/track/:orderId', async (req: Request, res: Response) => {
  const result = await courierService.trackShipment(routeParam(req.params.orderId));
  res.json(result);
});

// POST /api/admin/delivery/cancel/:orderId — cancel courier shipment
router.post('/cancel/:orderId', async (req: Request, res: Response) => {
  const result = await courierService.cancelShipment(routeParam(req.params.orderId));
  if (result.success) {
    await prisma.auditLog.create({
      data: {
        adminId: req.admin!.adminId,
        action: 'CANCEL_COURIER_SHIPMENT',
        targetType: 'order',
        targetId: routeParam(req.params.orderId),
        details: { message: result.message },
      },
    });
  }
  res.json(result);
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

export default router;
