import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

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
  res.json({ notifications, total, page, limit });
});

// GET /api/admin/notifications/unread-count
router.get('/unread-count', async (_req: Request, res: Response) => {
  const count = await prisma.notifications.count({ where: { read_status: false, audience: 'admin' } });
  res.json({ count });
});

// POST /api/admin/notifications — create alert
router.post('/', async (req: Request, res: Response) => {
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

  // Emit via socket
  try {
    const { io } = await import('../../app');
    if (user_id) {
      io.to(`user:${user_id}`).emit('notification:new', notification);
    } else {
      io.emit('notification:new', notification);
    }
  } catch { /* non-fatal */ }

  res.status(201).json({ notification });
});

// PATCH /api/admin/notifications/:id/read
router.patch('/:id/read', async (req: Request, res: Response) => {
  const notification = await prisma.notifications.update({
    where: { id: routeParam(req.params.id) },
    data: { read_status: true },
  });
  res.json({ notification });
});

// DELETE /api/admin/notifications/:id
router.delete('/:id', async (req: Request, res: Response) => {
  await prisma.notifications.delete({ where: { id: routeParam(req.params.id) } });
  res.json({ message: 'Notification deleted' });
});

export default router;
