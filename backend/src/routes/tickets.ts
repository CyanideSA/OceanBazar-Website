import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { routeParam } from '../utils/params';
import { requireAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';
import { io } from '../app';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// POST /api/tickets
router.post('/', async (req: Request, res: Response) => {
  const { orderId, productId, subject, category, priority = 'medium', message } = req.body as {
    orderId?: string;
    productId?: string;
    subject: string;
    category: string;
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
      messages: { create: { senderType: 'customer', senderId: req.user!.userId, message } },
    },
    include: { messages: true },
  });

  io.to('admin:chat').emit('ticket:new', { ticket });
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

  io.to(`ticket:${ticket.id}`).emit('ticket:message', { ticketId: ticket.id, message: msg });
  io.to('admin:chat').emit('ticket:message', { ticketId: ticket.id, message: msg });

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

  io.to(`ticket:${ticket.id}`).emit('ticket:seen', { ticketId: ticket.id, seenBy: 'customer' });
  io.to('admin:chat').emit('ticket:seen', { ticketId: ticket.id, seenBy: 'customer' });

  res.json({ ok: true });
});

export default router;
