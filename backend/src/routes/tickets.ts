import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { routeParam } from '../utils/params';
import { requireAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';
import { emitToRoom, emitToUser } from '../lib/adminEvents';

const router = Router();

router.use(requireAuth);

// POST /api/tickets
router.post('/', async (req: Request, res: Response) => {
  const { orderId, productId, subject, category = 'other', priority = 'medium', message } = req.body as {
    orderId?: string;
    productId?: string;
    subject: string;
    category?: string;
    priority?: string;
    message: string;
  };

  const ticket = await prisma.ticket.create({
    data: {
      id: generateEntityId(),
      userId: req.user!.userId,
      orderId: orderId ?? null,
      productId: productId ?? null,
      subject,
      category: category as 'payment' | 'delivery' | 'product' | 'other',
      priority: priority as 'low' | 'medium' | 'high' | 'urgent',
      messages: { create: { senderType: 'customer', senderId: req.user!.userId, message, attachments: [] } },
    },
    include: { messages: true },
  });

  emitToRoom('admin:chat', 'ticket:new', { ticket });
  emitToRoom('admin:crm', 'ticket:new', { ticket });
  if (subject?.toLowerCase().includes('return') || category === 'other') {
    emitToRoom('admin:returns', 'admin:return:new', { ticketId: ticket.id, subject, userId: req.user!.userId });
  }
  try {
    const { alertNewTicket } = await import('../services/teamsService');
    alertNewTicket(ticket.id, subject, priority).catch(() => {});
  } catch { /* non-fatal */ }
  res.status(201).json({ ticket });
});

// GET /api/tickets
router.get('/', async (req: Request, res: Response) => {
  const tickets = await prisma.ticket.findMany({
    where: { userId: req.user!.userId },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, senderType: true, senderId: true, message: true, seenAt: true, createdAt: true, attachments: true, ticketId: true } } },
  });
  res.json({ tickets });
});

// GET /api/tickets/:id  — full message history
router.get('/:id', async (req: Request, res: Response) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: routeParam(req.params.id), userId: req.user!.userId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      order: { select: { orderNumber: true, status: true } },
      product: { select: { id: true, titleEn: true } },
    },
  });
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
  res.json({ ticket });
});

// POST /api/tickets/:id/messages
router.post('/:id/messages', async (req: Request, res: Response) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: routeParam(req.params.id), userId: req.user!.userId },
  });
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
  if (['resolved', 'closed'].includes(ticket.status)) {
    res.status(400).json({ error: 'Ticket is closed' }); return;
  }

  const msg = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      senderType: 'customer',
      senderId: req.user!.userId,
      message: req.body.message,
      attachments: req.body.attachments ?? [],
    },
  });

  await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });

  emitToUser(ticket.userId, 'ticket:message', { ticketId: ticket.id, message: msg });
  emitToRoom('admin:chat', 'ticket:message', { ticketId: ticket.id, message: msg });

  res.status(201).json({ message: msg });
});

// POST /api/tickets/:id/seen — mark admin messages as seen
router.post('/:id/seen', async (req: Request, res: Response) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: routeParam(req.params.id), userId: req.user!.userId },
  });
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }

  await prisma.ticketMessage.updateMany({
    where: { ticketId: ticket.id, senderType: 'admin', seenAt: null },
    data: { seenAt: new Date() },
  });

  emitToUser(ticket.userId, 'ticket:seen', { ticketId: ticket.id, seenBy: 'customer' });
  emitToRoom('admin:chat', 'ticket:seen', { ticketId: ticket.id, seenBy: 'customer' });

  res.json({ ok: true });
});

export default router;
