import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/analytics/sales — sales over time
router.get('/sales', async (req: Request, res: Response) => {
  const days = parseInt(String(req.query.days || '30'));
  const since = new Date(Date.now() - days * 86400_000);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, paymentStatus: 'paid' },
    select: { createdAt: true, total: true },
    orderBy: { createdAt: 'asc' },
  });

  // Group by day
  const salesByDay: Record<string, { date: string; orders: number; revenue: number }> = {};
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    if (!salesByDay[day]) salesByDay[day] = { date: day, orders: 0, revenue: 0 };
    salesByDay[day].orders++;
    salesByDay[day].revenue += Number(o.total);
  }

  res.json({ sales: Object.values(salesByDay), totalOrders: orders.length, totalRevenue: orders.reduce((s, o) => s + Number(o.total), 0) });
});

// GET /api/admin/analytics/customer-growth
router.get('/customer-growth', async (req: Request, res: Response) => {
  const days = parseInt(String(req.query.days || '30'));
  const since = new Date(Date.now() - days * 86400_000);

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const growthByDay: Record<string, { date: string; newUsers: number }> = {};
  for (const u of users) {
    const day = u.createdAt.toISOString().slice(0, 10);
    if (!growthByDay[day]) growthByDay[day] = { date: day, newUsers: 0 };
    growthByDay[day].newUsers++;
  }

  const totalUsers = await prisma.user.count();
  res.json({ growth: Object.values(growthByDay), totalUsers, newUsersInPeriod: users.length });
});

// GET /api/admin/analytics/top-products
router.get('/top-products', async (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '10'));
  const topItems = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });

  // Enrich with product info
  const productIds = topItems.map(i => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, titleEn: true, titleBn: true, sku: true, stock: true },
  });
  const productMap = new Map(products.map(p => [p.id, p]));

  const enriched = topItems.map(i => ({
    productId: i.productId,
    product: productMap.get(i.productId),
    totalSold: i._sum.quantity || 0,
    totalRevenue: Number(i._sum.lineTotal || 0),
  }));

  res.json({ topProducts: enriched });
});

// GET /api/admin/analytics/revenue-breakdown
router.get('/revenue-breakdown', async (_req: Request, res: Response) => {
  const byMethod = await prisma.order.groupBy({
    by: ['paymentMethod'],
    _sum: { total: true },
    _count: true,
    where: { paymentStatus: 'paid' },
  });

  const byStatus = await prisma.order.groupBy({
    by: ['status'],
    _count: true,
  });

  res.json({ byPaymentMethod: byMethod, byOrderStatus: byStatus });
});

// GET /api/admin/analytics/order-funnel
router.get('/order-funnel', async (_req: Request, res: Response) => {
  const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
  const counts: Record<string, number> = {};
  for (const s of statuses) {
    counts[s] = await prisma.order.count({ where: { status: s } });
  }
  res.json({ funnel: counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
});

// GET /api/admin/analytics/live-snapshot — real-time counters
router.get('/live-snapshot', async (_req: Request, res: Response) => {
  const [totalOrders, totalRevenue, totalUsers, pendingOrders, activeChats, openTickets, pendingReturns] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: 'paid' } }),
    prisma.user.count(),
    prisma.order.count({ where: { status: 'pending' } }),
    prisma.chat_sessions.count({ where: { is_active: true } }),
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.return_requests.count({ where: { status: 'pending' } }),
  ]);

  res.json({
    totalOrders,
    totalRevenue: Number(totalRevenue._sum.total || 0),
    totalUsers,
    pendingOrders,
    activeChats,
    openTickets,
    pendingReturns,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/admin/analytics/customers — customer analytics
router.get('/customers', async (_req: Request, res: Response) => {
  const totalUsers = await prisma.user.count();
  const wholesaleUsers = await prisma.user.count({ where: { userType: 'wholesale' } });
  const retailUsers = await prisma.user.count({ where: { userType: 'retail' } });
  const activeUsers = await prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } });

  const topCustomers = await prisma.order.groupBy({
    by: ['userId'],
    _sum: { total: true },
    _count: true,
    orderBy: { _sum: { total: 'desc' } },
    take: 10,
  });

  const userIds = topCustomers.map(c => c.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, userType: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const enrichedTop = topCustomers.map(c => ({
    userId: c.userId,
    user: userMap.get(c.userId),
    orderCount: c._count,
    totalSpent: Number(c._sum.total || 0),
  }));

  res.json({ totalUsers, wholesaleUsers, retailUsers, activeUsers, topCustomers: enrichedTop });
});

export default router;
