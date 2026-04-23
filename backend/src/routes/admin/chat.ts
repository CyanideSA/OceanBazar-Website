import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/chat/sessions
router.get('/sessions', async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { active } = req.query as Record<string, string>;
  const where: any = {};
  if (active === 'true') where.is_active = true;
  if (active === 'false') where.is_active = false;

  const [sessions, total] = await Promise.all([
    prisma.chat_sessions.findMany({ where, orderBy: { last_message_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.chat_sessions.count({ where }),
  ]);
  res.json({ sessions, total, page, limit });
});

// GET /api/admin/chat/sessions/:id
router.get('/sessions/:id', async (req: Request, res: Response) => {
  const session = await prisma.chat_sessions.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!session) { res.status(404).json({ error: 'Chat session not found' }); return; }
  res.json({ session });
});

// POST /api/admin/chat/sessions/:id/messages — admin sends message
router.post('/sessions/:id/messages', async (req: Request, res: Response) => {
  const session = await prisma.chat_sessions.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!session) { res.status(404).json({ error: 'Chat session not found' }); return; }

  const messages = Array.isArray(session.messages) ? session.messages : [];
  const newMsg = {
    id: Date.now().toString(36),
    sender: 'admin',
    senderId: String(req.admin!.adminId),
    message: req.body.message,
    timestamp: new Date().toISOString(),
  };
  (messages as any[]).push(newMsg);

  await prisma.chat_sessions.update({
    where: { id: session.id },
    data: {
      messages,
      agent_engaged: true,
      last_message_at: new Date(),
    },
  });

  // Emit via socket
  try {
    const { io } = await import('../../app');
    io.to(`user:${session.user_id}`).emit('chat:message', newMsg);
    io.to('admin:chat').emit('chat:message', { sessionId: session.id, ...newMsg });
  } catch { /* non-fatal */ }

  res.status(201).json({ message: newMsg });
});

// PATCH /api/admin/chat/sessions/:id/close — close session
router.patch('/sessions/:id/close', async (req: Request, res: Response) => {
  const session = await prisma.chat_sessions.update({
    where: { id: routeParam(req.params.id) },
    data: { is_active: false, closed_by_agent_at: new Date() },
  });
  res.json({ session, message: 'Session closed' });
});

export default router;
