import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { io } from '../../app';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/tickets
router.get('/', async (req: Request, res: Response) => {
  const { status, priority, category, page = '1' } = req.query as Record<string, string>;
  const limit = 20;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        messages: { take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, senderType: true, senderId: true, message: true, seenAt: true, createdAt: true, attachments: true, ticketId: true } },
        admin: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (parseInt(page) - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({ tickets, total, page: parseInt(page), limit });
});

// GET /api/admin/tickets/:id
router.get('/:id', async (req: Request, res: Response) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: routeParam(req.params.id) },
    include: {
      user: true,
      order: { select: { orderNumber: true, status: true, total: true } },
      product: { select: { id: true, titleEn: true } },
      paymentTx: { select: { id: true, amount: true, status: true } },
      messages: { orderBy: { createdAt: 'asc' } },
      admin: { select: { id: true, name: true } },
    },
  });
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
  res.json({ ticket });
});

// PUT /api/admin/tickets/:id — update status / assignment
router.put('/:id', async (req: Request, res: Response) => {
  const { status, priority, assignedTo, productId, paymentTxId } = req.body as {
    status?: string;
    priority?: string;
    assignedTo?: number;
    productId?: string | null;
    paymentTxId?: string | null;
  };

  const ticket = await prisma.ticket.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(status && { status: status as 'open' | 'in_progress' | 'resolved' | 'closed' }),
      ...(priority && { priority: priority as 'low' | 'medium' | 'high' | 'urgent' }),
      ...(assignedTo !== undefined && { assignedTo }),
      ...(productId !== undefined && { productId }),
      ...(paymentTxId !== undefined && { paymentTxId }),
    },
  });

  res.json({ ticket });
});

// POST /api/admin/tickets/:id/reply — admin sends message
router.post('/:id/reply', async (req: Request, res: Response) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }

  const msg = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      senderType: 'admin',
      senderId: String(req.admin!.adminId),
      message: req.body.message,
      attachments: req.body.attachments ?? [],
    },
  });

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      updatedAt: new Date(),
      ...(ticket.status === 'open' && { status: 'in_progress' }),
    },
  });

  io.to(`ticket:${ticket.id}`).emit('ticket:message', { ticketId: ticket.id, message: msg, fromAdmin: true });
  io.to('admin:chat').emit('ticket:message', { ticketId: ticket.id, message: msg, fromAdmin: true });

  res.status(201).json({ message: msg });
});

// POST /api/admin/tickets/:id/seen — admin marks customer messages as seen
router.post('/:id/seen', async (req: Request, res: Response) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }

  await prisma.ticketMessage.updateMany({
    where: { ticketId: ticket.id, senderType: 'customer', seenAt: null },
    data: { seenAt: new Date() },
  });

  io.to(`ticket:${ticket.id}`).emit('ticket:seen', { ticketId: ticket.id, seenBy: 'admin' });
  io.to('admin:chat').emit('ticket:seen', { ticketId: ticket.id, seenBy: 'admin' });

  res.json({ ok: true });
});

export default router;
