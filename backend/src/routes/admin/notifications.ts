import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../../utils/params';
import { emitToUser, emitBroadcast } from '../../lib/adminEvents';
import { requireAdminReauth } from '../../middleware/adminReauth';

const router = Router();
const prisma = new PrismaClient();

const normalizeNotification = (n: any) => ({
  id: n.id,
  title: n.title,
  message: n.message,
  image: n.image ?? null,
  audience: n.audience,
  kind: n.kind ?? null,
  entityId: n.entity_id ?? null,
  read: Boolean(n.read_status),
  createdByAdminId: n.created_by_admin_id ?? null,
  userId: n.user_id ?? null,
  createdAt: n.created_at,
});

// GET /api/admin/notifications
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { audience, kind } = req.query as Record<string, string>;
  const where: any = {};
  if (audience) where.audience = audience;
  if (kind) where.kind = kind;

  const [notifications, total] = await Promise.all([
    prisma.notifications.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.notifications.count({ where }),
  ]);
  res.json({ notifications: notifications.map(normalizeNotification), total, page, limit });
});

// GET /api/admin/notifications/unread-count
router.get('/unread-count', async (_req: Request, res: Response) => {
  const count = await prisma.notifications.count({ where: { read_status: false, audience: 'admin' } });
  res.json({ count });
});

// POST /api/admin/notifications — create alert
router.post('/', requireAdminReauth(), async (req: Request, res: Response) => {
  const { title, message, audience, user_id, kind, entity_id, image } = req.body;
  if (!title || !message) { res.status(400).json({ error: 'title and message required' }); return; }

  const notification = await prisma.notifications.create({
    data: {
      id: uuidv4(),
      title,
      message,
      audience: audience || 'all',
      user_id: user_id || null,
      kind: kind || null,
      entity_id: entity_id || null,
      image: image || null,
      created_by_admin_id: String(req.admin!.adminId),
    },
  });

  if (user_id) {
    emitToUser(user_id, 'notification:new', notification);
  } else {
    emitBroadcast('notification:new', notification);
  }

  res.status(201).json({ notification: normalizeNotification(notification) });
});

// PATCH /api/admin/notifications/:id/read
router.patch('/:id/read', async (req: Request, res: Response) => {
  const notification = await prisma.notifications.update({
    where: { id: routeParam(req.params.id) },
    data: { read_status: true },
  });
  res.json({ notification: normalizeNotification(notification) });
});

// DELETE /api/admin/notifications/:id
router.delete('/:id', requireAdminReauth(), async (req: Request, res: Response) => {
  await prisma.notifications.delete({ where: { id: routeParam(req.params.id) } });
  res.json({ message: 'Notification deleted' });
});

export default router;
