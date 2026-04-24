import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireAdmin, requireRole } from '../../middleware/auth';
import { generateEntityId, generateTrackingNumber, generateSlug } from '../../utils/hexId';
import fileImportRouter from './file-import';
import obPointsAdminRouter from './ob-points';
import ticketsAdminRouter from './tickets';
import studioRouter from './studio';
import inventoryRouter from './inventory';
import returnsRouter from './returns';
import deliveryAdminRouter from './delivery';
import paymentsAdminRouter from './payments';
import couponsAdminRouter from './coupons';
import disputesRouter from './disputes';
import chatAdminRouter from './chat';
import notificationsRouter from './notifications';
import applicationsRouter from './applications';
import teamRouter from './team';
import auditLogsRouter from './audit-logs';
import globalSettingsRouter from './global-settings';
import analyticsRouter from './analytics';
import { refreshProductReviewStats } from '../../services/reviewService';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

// ─── Admin auth (must be registered before studioRouter, which uses requireAdmin) ─

router.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };
  console.log(`[ADMIN AUTH] Login attempt for username: ${username}`);
  const admin = await prisma.adminUser.findFirst({
    where: { OR: [{ username }, { email: username }], active: true },
  });
  if (!admin) {
    console.error(`[ADMIN AUTH] Login failed: admin not found for username: ${username}`);
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    console.error(`[ADMIN AUTH] Login failed: invalid password for username: ${username}`);
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  console.log(`[ADMIN AUTH] Login successful for admin: ${admin.id}, username: ${admin.username}`);
  const token = jwt.sign(
    { adminId: admin.id, role: admin.role },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '8h' } as jwt.SignOptions
  );
  res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
});

router.get('/auth/me', requireAdmin, async (req: Request, res: Response) => {
  const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.adminId } });
  if (!admin) { res.status(404).json({ error: 'Admin not found' }); return; }
  res.json({ admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
});

// ─── Sub-routers ──────────────────────────────────────────────────────────────

router.use('/file-import', requireAdmin, fileImportRouter);
router.use('/ob-points', requireAdmin, obPointsAdminRouter);
router.use('/tickets', requireAdmin, ticketsAdminRouter);
router.use('/inventory', requireAdmin, inventoryRouter);
router.use('/returns', requireAdmin, returnsRouter);
router.use('/delivery', requireAdmin, deliveryAdminRouter);
router.use('/payments', requireAdmin, paymentsAdminRouter);
router.use('/coupons', requireAdmin, couponsAdminRouter);
router.use('/disputes', requireAdmin, disputesRouter);
router.use('/chat', requireAdmin, chatAdminRouter);
router.use('/notifications', requireAdmin, notificationsRouter);
router.use('/applications', requireAdmin, applicationsRouter);
router.use('/team', requireAdmin, teamRouter);
router.use('/audit-logs', requireAdmin, auditLogsRouter);
router.use('/global-settings', requireAdmin, globalSettingsRouter);
router.use('/analytics', requireAdmin, analyticsRouter);
router.use(studioRouter);

// ─── Dashboard overview ───────────────────────────────────────────────────────

router.get('/overview', requireAdmin, async (_req, res: Response) => {
  const [totalOrders, totalRevenue, totalUsers, pendingTickets] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: 'paid' } }),
    prisma.user.count(),
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
  ]);
  res.json({
    totalOrders,
    totalRevenue: Number(totalRevenue._sum.total ?? 0),
    totalUsers,
    pendingTickets,
  });
});

// ─── Products CRUD ────────────────────────────────────────────────────────────

router.get('/products', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = parseInt(String(req.query.limit || '20'));
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      include: { category: true, productAssets: { take: 1 }, pricing: true },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count(),
  ]);
  res.json({ products, total, page, limit });
});

router.post('/products', requireAdmin, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const data = req.body as Record<string, unknown>;
  const product = await prisma.product.create({
    data: {
      id: generateEntityId(),
      titleEn: data.titleEn as string,
      titleBn: (data.titleBn as string) || (data.titleEn as string),
      descriptionEn: data.descriptionEn as string | undefined,
      descriptionBn: data.descriptionBn as string | undefined,
      categoryId: data.categoryId as string,
      brand: data.brand as string | undefined,
      brandLogoUrl: data.brandLogoUrl as string | undefined,
      sku: data.sku as string | undefined,
      moq: (data.moq as number) || 1,
      stock: (data.stock as number) || 0,
      status: (data.status as 'active' | 'draft' | 'archived') || 'draft',
      isFeatured: Boolean(data.isFeatured),
      pricing: {
        create: [
          {
            customerType: 'retail',
            price: Number(data.retailPrice),
            compareAt: data.compareAt != null ? Number(data.compareAt) : null,
            tier1MinQty: (data.retailTier1Min as number) ?? 2,
            tier1Discount: (data.retailTier1Disc as number) ?? 5,
            tier2MinQty: (data.retailTier2Min as number) ?? 6,
            tier2Discount: (data.retailTier2Disc as number) ?? 10,
            tier3MinQty: (data.retailTier3Min as number) ?? 11,
            tier3Discount: (data.retailTier3Disc as number) ?? 15,
          },
          ...(data.wholesalePrice != null
            ? [
                {
                  customerType: 'wholesale' as const,
                  price: Number(data.wholesalePrice),
                  compareAt: data.wholesaleCompareAt != null ? Number(data.wholesaleCompareAt) : null,
                  tier1MinQty: (data.wholesaleTier1Min as number) ?? ((data.moq as number) || 1),
                  tier1Discount: (data.wholesaleTier1Disc as number) ?? 2,
                  tier2MinQty: (data.wholesaleTier2Min as number) ?? ((data.moq as number) || 1) * 3,
                  tier2Discount: (data.wholesaleTier2Disc as number) ?? 5,
                  tier3MinQty: (data.wholesaleTier3Min as number) ?? ((data.moq as number) || 1) * 6,
                  tier3Discount: (data.wholesaleTier3Disc as number) ?? 8,
                },
              ]
            : []),
        ],
      },
    },
    include: { pricing: true },
  });
  res.status(201).json({ product });
});

router.delete('/products/:id', requireAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  await prisma.product.update({ where: { id: routeParam(req.params.id) }, data: { status: 'archived' } });
  res.json({ message: 'Product archived' });
});

// ─── Categories CRUD ──────────────────────────────────────────────────────────

router.get('/categories', requireAdmin, async (_req, res: Response) => {
  const categories = await prisma.category.findMany({
    include: { children: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ categories });
});

router.post('/categories', requireAdmin, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { nameEn, nameBn, parentId, icon, sortOrder } = req.body;
  const cat = await prisma.category.create({
    data: { id: generateEntityId(), nameEn, nameBn: nameBn || nameEn, parentId: parentId ?? null, icon, sortOrder: sortOrder ?? 0, slug: generateSlug(nameEn) },
  });
  res.status(201).json({ category: cat });
});

// ─── Orders ───────────────────────────────────────────────────────────────────

router.get('/orders', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      include: { user: { select: { name: true, email: true } }, items: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count(),
  ]);
  res.json({ orders, total, page, limit });
});

router.get('/orders/:id', requireAdmin, async (req: Request, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: routeParam(req.params.id) },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      items: true,
      timeline: { orderBy: { createdAt: 'asc' } },
      shipments: true,
      shippingAddress: true,
    },
  });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
  res.json({ order });
});

async function handleOrderStatusUpdate(req: Request, res: Response) {
  const { status, note } = req.body as { status: string; note?: string };
  const order = await prisma.order.update({
    where: { id: routeParam(req.params.id) },
    data: { status: status as 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' },
  });
  await prisma.orderTimeline.create({
    data: { orderId: order.id, status, note: note ?? `Status updated to ${status}`, actorType: 'admin', actorId: String(req.admin!.adminId) },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_ORDER_STATUS', targetType: 'order', targetId: order.id, details: { status, note } },
  });

  // Send email/SMS on meaningful status changes
  try {
    const { sendShippingUpdate } = await import('../../services/emailService');
    const { sendShippingUpdateSms } = await import('../../services/smsService');
    const fullOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { user: { select: { email: true, phone: true } } } });
    if (fullOrder?.user.email) sendShippingUpdate(fullOrder.user.email, order.orderNumber, status).catch(() => {});
    if (fullOrder?.user.phone) sendShippingUpdateSms(fullOrder.user.phone, order.orderNumber, status).catch(() => {});
  } catch { /* non-fatal */ }

  res.json({ order });
}
router.put('/orders/:id/status', requireAdmin, handleOrderStatusUpdate);
router.patch('/orders/:id/status', requireAdmin, handleOrderStatusUpdate);

router.patch('/orders/:id/tracking', requireAdmin, async (req: Request, res: Response) => {
  const { trackingNumber, carrier } = req.body;
  const order = await prisma.order.update({
    where: { id: routeParam(req.params.id) },
    data: { ...(trackingNumber && { trackingNumber }), ...(carrier && {}) },
  });
  if (trackingNumber) {
    await prisma.orderTimeline.create({
      data: { orderId: order.id, status: order.status, note: `Tracking updated: ${trackingNumber}${carrier ? ` via ${carrier}` : ''}`, actorType: 'admin' },
    });
  }
  res.json({ order });
});

router.patch('/orders/:id/payment-status', requireAdmin, async (req: Request, res: Response) => {
  const { paymentStatus } = req.body;
  const order = await prisma.order.update({
    where: { id: routeParam(req.params.id) },
    data: { paymentStatus },
  });
  await prisma.orderTimeline.create({
    data: { orderId: order.id, status: order.status, note: `Payment status → ${paymentStatus}`, actorType: 'admin' },
  });
  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_PAYMENT_STATUS', targetType: 'order', targetId: order.id, details: { paymentStatus } },
  });
  res.json({ order });
});

// ─── Shipments ────────────────────────────────────────────────────────────────

router.post('/shipments', requireAdmin, async (req: Request, res: Response) => {
  const { orderId, carrier, estimatedDelivery } = req.body as {
    orderId: string; carrier: string; estimatedDelivery?: string;
  };

  const trackingNumber = generateTrackingNumber();
  const shipment = await prisma.shipment.create({
    data: {
      id: generateEntityId(),
      orderId,
      carrier,
      trackingNumber,
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'shipped', trackingNumber },
  });
  await prisma.orderTimeline.create({
    data: { orderId, status: 'shipped', note: `Shipped via ${carrier}. Tracking: ${trackingNumber}`, actorType: 'admin' },
  });

  res.status(201).json({ shipment, trackingNumber });
});

// ─── Customers ────────────────────────────────────────────────────────────────

router.get('/customers/:id', requireAdmin, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: routeParam(req.params.id) },
    include: { savedAddresses: true },
  });
  if (!user) { res.status(404).json({ error: 'Customer not found' }); return; }
  res.json({ user });
});

router.put('/customers/:id', requireAdmin, async (req: Request, res: Response) => {
  const { name, email, phone, userType, accountStatus, preferredLang } = req.body;
  const user = await prisma.user.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      ...(phone && { phone }),
      ...(userType && { userType }),
      ...(accountStatus && { accountStatus }),
      ...(preferredLang && { preferredLang }),
    },
  });
  res.json({ user });
});

router.patch('/customers/:id/account-status', requireAdmin, async (req: Request, res: Response) => {
  const { accountStatus } = req.body;
  const user = await prisma.user.update({
    where: { id: routeParam(req.params.id) },
    data: { accountStatus },
  });
  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_CUSTOMER_STATUS', targetType: 'user', targetId: user.id, details: { accountStatus } },
  });
  res.json({ user });
});

router.delete('/customers/:id', requireAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  await prisma.user.update({ where: { id: routeParam(req.params.id) }, data: { accountStatus: 'suspended' } });
  res.json({ message: 'Customer suspended' });
});

router.get('/customers/:id/orders', requireAdmin, async (req: Request, res: Response) => {
  const orders = await prisma.order.findMany({
    where: { userId: routeParam(req.params.id) },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ orders });
});

router.get('/customers', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const [users, total] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20 }),
    prisma.user.count(),
  ]);
  res.json({ users, total, page });
});

// ─── Reviews moderation ──────────────────────────────────────────────────────

router.get('/reviews', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const { status } = req.query as Record<string, string>;
  const limit = 20;
  const where = status ? { status: status as 'pending' | 'approved' | 'rejected' } : {};
  const [reviews, total] = await Promise.all([
    prisma.productReview.findMany({
      where,
      include: { user: { select: { name: true } }, product: { select: { titleEn: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.productReview.count({ where }),
  ]);
  res.json({ reviews, total, page, limit });
});

// GET /api/admin/reviews/pending — alias for ?status=pending
router.get('/reviews/pending', requireAdmin, async (_req: Request, res: Response) => {
  const reviews = await prisma.productReview.findMany({
    where: { status: 'pending' },
    include: { user: { select: { name: true } }, product: { select: { titleEn: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ reviews });
});

// GET /api/admin/reviews/product/:productId
router.get('/reviews/product/:productId', requireAdmin, async (req: Request, res: Response) => {
  const reviews = await prisma.productReview.findMany({
    where: { productId: routeParam(req.params.productId) },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ reviews });
});

// PATCH /api/admin/reviews/:id/moderate — alias for PATCH /reviews/:id
router.patch('/reviews/:id/moderate', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const { status, note } = req.body as { status: string; note?: string };
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'status must be pending, approved, or rejected' });
    return;
  }
  const prev = await prisma.productReview.findUnique({ where: { id } });
  if (!prev) { res.status(404).json({ error: 'Review not found' }); return; }
  const review = await prisma.productReview.update({
    where: { id },
    data: { status: status as 'pending' | 'approved' | 'rejected' },
  });
  await refreshProductReviewStats(prev.productId);
  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'MODERATE_REVIEW', targetType: 'product_review', targetId: id, details: { from: prev.status, to: status, note } },
  });
  res.json({ review });
});

// ─── Analytics ────────────────────────────────────────────────────────────────

router.patch('/reviews/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const { status } = req.body as { status: string };
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'status must be pending, approved, or rejected' });
    return;
  }
  const prev = await prisma.productReview.findUnique({ where: { id } });
  if (!prev) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  const review = await prisma.productReview.update({
    where: { id },
    data: { status: status as 'pending' | 'approved' | 'rejected' },
  });
  await refreshProductReviewStats(prev.productId);
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.adminId,
      action: 'MODERATE_REVIEW',
      targetType: 'product_review',
      targetId: id,
      details: { from: prev.status, to: status },
    },
  });
  res.json({ review });
});

router.get('/analytics/dashboard', requireAdmin, async (_req, res: Response) => {
  const [orderStats, revenueByDay, topProducts, newUsers] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], _count: true }),
    prisma.order.groupBy({
      by: ['createdAt'],
      _sum: { total: true },
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) }, paymentStatus: 'paid' },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.orderItem.groupBy({ by: ['productId'], _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 10 }),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } }),
  ]);
  res.json({ orderStats, revenueByDay, topProducts, newUsers });
});

// ─── Live snapshot alias (CRM calls /api/admin/live/snapshot) ────────────────

router.get('/live/snapshot', requireAdmin, async (_req: Request, res: Response) => {
  const [totalOrders, totalRevenue, totalUsers, pendingOrders, activeChats, openTickets, pendingReturns] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: 'paid' } }),
    prisma.user.count(),
    prisma.order.count({ where: { status: 'pending' } }),
    prisma.chat_sessions.count({ where: { is_active: true } }),
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.return_requests.count({ where: { status: 'pending' } }),
  ]);
  res.json({ totalOrders, totalRevenue: Number(totalRevenue._sum.total || 0), totalUsers, pendingOrders, activeChats, openTickets, pendingReturns, timestamp: new Date().toISOString() });
});

// GET /api/admin/live/stream — SSE for real-time admin dashboard
router.get('/live/stream', async (req: Request, res: Response) => {
  // Authenticate via query token
  const token = req.query.token as string;
  if (!token) { res.status(401).end(); return; }
  let tokenValid = false;
  try {
    jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'oceanbazar-jwt-secret');
    tokenValid = true;
  } catch { /* try java secret fallback */ }
  if (!tokenValid) {
    try {
      jwt.verify(token, process.env.JWT_SECRET_KEY || 'oceanbazar-secret-key-change-in-production');
      tokenValid = true;
    } catch { /* invalid */ }
  }
  if (!tokenValid) { res.status(401).end(); return; }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = async () => {
    try {
      const [totalOrders, totalRevenue, totalUsers, pendingOrders, activeChats, openTickets, pendingReturns] = await Promise.all([
        prisma.order.count(),
        prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: 'paid' } }),
        prisma.user.count(),
        prisma.order.count({ where: { status: 'pending' } }),
        prisma.chat_sessions.count({ where: { is_active: true } }),
        prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
        prisma.return_requests.count({ where: { status: 'pending' } }),
      ]);
      const payload = { totalOrders, totalRevenue: Number(totalRevenue._sum.total || 0), totalUsers, pendingOrders, activeChats, openTickets, pendingReturns, timestamp: new Date().toISOString() };
      res.write(`event: live_update\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch { /* non-fatal */ }
  };

  await send();
  const interval = setInterval(send, 10000);
  req.on('close', () => clearInterval(interval));
});

// ─── Fulfillment aliases (CRM calls /api/admin/fulfillment/shipments) ────────

router.get('/fulfillment/shipments', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const where: any = {};
  if (req.query.status) where.internal_status = req.query.status;
  if (req.query.orderId) where.order_id = req.query.orderId;
  const [shipments, total] = await Promise.all([
    prisma.courier_shipments.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.courier_shipments.count({ where }),
  ]);
  res.json({ shipments, total, page, limit });
});

router.get('/fulfillment/shipments/order/:orderId', requireAdmin, async (req: Request, res: Response) => {
  const shipments = await prisma.courier_shipments.findMany({ where: { order_id: routeParam(req.params.orderId) } });
  const legacyShipments = await prisma.shipment.findMany({ where: { orderId: routeParam(req.params.orderId) } });
  res.json({ shipments: [...shipments, ...legacyShipments] });
});

router.get('/fulfillment/shipments/:id', requireAdmin, async (req: Request, res: Response) => {
  const cs = await prisma.courier_shipments.findUnique({ where: { id: routeParam(req.params.id) } });
  if (cs) { res.json({ shipment: cs }); return; }
  const legacy = await prisma.shipment.findUnique({ where: { id: routeParam(req.params.id) } });
  if (legacy) { res.json({ shipment: legacy }); return; }
  res.status(404).json({ error: 'Shipment not found' });
});

router.post('/fulfillment/shipments', requireAdmin, async (req: Request, res: Response) => {
  const { orderId, carrier, estimatedDelivery, trackingNumber } = req.body;
  const shipment = await prisma.shipment.create({
    data: {
      id: generateEntityId(),
      orderId,
      carrier: carrier || 'manual',
      trackingNumber: trackingNumber || generateTrackingNumber(),
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
    },
  });
  await prisma.order.update({ where: { id: orderId }, data: { status: 'shipped', trackingNumber: shipment.trackingNumber } });
  res.status(201).json({ shipment });
});

router.patch('/fulfillment/shipments/:id/status', requireAdmin, async (req: Request, res: Response) => {
  const { status } = req.body;
  const cs = await prisma.courier_shipments.findUnique({ where: { id: routeParam(req.params.id) } });
  if (cs) {
    const updated = await prisma.courier_shipments.update({ where: { id: cs.id }, data: { internal_status: status, updated_at: new Date() } });
    res.json({ shipment: updated });
    return;
  }
  const legacy = await prisma.shipment.findUnique({ where: { id: routeParam(req.params.id) } });
  if (legacy) {
    const updated = await prisma.shipment.update({ where: { id: legacy.id }, data: { status } });
    res.json({ shipment: updated });
    return;
  }
  res.status(404).json({ error: 'Shipment not found' });
});

router.delete('/fulfillment/shipments/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.courier_shipments.delete({ where: { id: routeParam(req.params.id) } });
  } catch {
    try { await prisma.shipment.delete({ where: { id: routeParam(req.params.id) } }); }
    catch { res.status(404).json({ error: 'Shipment not found' }); return; }
  }
  res.json({ message: 'Shipment deleted' });
});

// ─── Notifications extras ────────────────────────────────────────────────────

router.post('/notifications/read-all', requireAdmin, async (_req: Request, res: Response) => {
  await prisma.notifications.updateMany({ where: { read_status: false, audience: 'admin' }, data: { read_status: true } });
  res.json({ message: 'All marked read' });
});

router.post('/notifications/broadcast-customers', requireAdmin, async (req: Request, res: Response) => {
  const { title, message, image } = req.body;
  const { v4: uuidv4 } = await import('uuid');
  const notif = await prisma.notifications.create({
    data: { id: uuidv4(), title, message, audience: 'customers', image, created_by_admin_id: String(req.admin!.adminId) },
  });
  try {
    const { io } = await import('../../app');
    io.emit('notification:new', notif);
  } catch { /* non-fatal */ }
  res.status(201).json({ notification: notif });
});

// ─── Chat conversation aliases (CRM calls /chat/conversations) ──────────────

router.get('/chat/conversations', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const [sessions, total] = await Promise.all([
    prisma.chat_sessions.findMany({ orderBy: { last_message_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.chat_sessions.count(),
  ]);
  res.json({ sessions, total, page, limit });
});

router.get('/chat/conversations/:id', requireAdmin, async (req: Request, res: Response) => {
  const session = await prisma.chat_sessions.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json({ session });
});

router.post('/chat/conversations/:id/reply', requireAdmin, async (req: Request, res: Response) => {
  const session = await prisma.chat_sessions.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const newMsg = { id: Date.now().toString(36), sender: 'admin', senderId: String(req.admin!.adminId), message: req.body.message, timestamp: new Date().toISOString() };
  (messages as any[]).push(newMsg);
  await prisma.chat_sessions.update({ where: { id: session.id }, data: { messages, agent_engaged: true, last_message_at: new Date() } });
  try {
    const { io } = await import('../../app');
    io.to(`user:${session.user_id}`).emit('chat:message', newMsg);
    io.to('admin:chat').emit('chat:message', { sessionId: session.id, ...newMsg });
  } catch {}
  res.status(201).json({ message: newMsg });
});

router.post('/chat/conversations/:id/close', requireAdmin, async (req: Request, res: Response) => {
  const session = await prisma.chat_sessions.update({
    where: { id: routeParam(req.params.id) },
    data: { is_active: false, closed_by_agent_at: new Date() },
  });
  res.json({ session, message: 'Session closed' });
});

// ─── Upload / Media endpoints ────────────────────────────────────────────────

import multer from 'multer';
import { uploadImage, uploadLogo, deleteImage } from '../../services/cloudinaryService';

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/upload', requireAdmin, memUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  const result = await uploadImage(req.file.buffer, 'oceanbazar/admin');
  res.json(result);
});

router.post('/media/upload', requireAdmin, memUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  const folder = (req.body.folder as string) || 'oceanbazar/media';
  const result = await uploadImage(req.file.buffer, folder);
  res.json(result);
});

router.post('/media/upload-multiple', requireAdmin, memUpload.array('files', 20), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) { res.status(400).json({ error: 'No files' }); return; }
  const folder = (req.body.folder as string) || 'oceanbazar/media';
  const results = await Promise.all(files.map(f => uploadImage(f.buffer, folder)));
  res.json({ results });
});

router.delete('/media/delete', requireAdmin, async (req: Request, res: Response) => {
  const publicId = (req.query.publicId as string) || '';
  if (!publicId) { res.status(400).json({ error: 'publicId required' }); return; }
  const result = await deleteImage(publicId);
  res.json(result);
});

router.post('/products/upload', requireAdmin, memUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  const result = await uploadImage(req.file.buffer, 'oceanbazar/products');
  res.json(result);
});

// ─── Wholesale approve/revoke (CRM calls) ───────────────────────────────────

router.post('/wholesale/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  const user = await prisma.user.update({ where: { id: routeParam(req.params.id) }, data: { userType: 'wholesale' } });
  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'APPROVE_WHOLESALE', targetType: 'user', targetId: user.id, details: {} },
  });
  res.json({ user, message: 'Wholesale approved' });
});

router.post('/wholesale/:id/revoke', requireAdmin, async (req: Request, res: Response) => {
  const user = await prisma.user.update({ where: { id: routeParam(req.params.id) }, data: { userType: 'retail' } });
  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'REVOKE_WHOLESALE', targetType: 'user', targetId: user.id, details: {} },
  });
  res.json({ user, message: 'Wholesale revoked' });
});

// ─── Applications business-inquiries alias ───────────────────────────────────

router.get('/applications/business-inquiries', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const [inquiries, total] = await Promise.all([
    prisma.business_inquiries.findMany({ orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.business_inquiries.count(),
  ]);
  res.json({ inquiries, total, page, limit });
});

export default router;
