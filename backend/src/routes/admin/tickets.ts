import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import multer from 'multer';
import { emitToRoom, emitToUser } from '../../lib/adminEvents';
import { routeParam } from '../../utils/params';
import { uploadImage } from '../../services/cloudinaryService';
import { sendSupportReply } from '../../services/emailService';
import { logCommunication } from '../../services/communicationLogService';

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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

// GET /api/admin/tickets/stats — must be before /:id
router.get('/stats', async (_req: Request, res: Response) => {
  const counts = await prisma.ticket.groupBy({ by: ['status'], _count: { status: true } });
  const stats: Record<string, number> = {};
  for (const c of counts) { stats[String(c.status)] = c._count.status; }
  res.json(stats);
});

// POST /api/admin/tickets — admin creates a ticket on behalf of a user
router.post('/', async (req: Request, res: Response) => {
  const { userId, subject, category, priority, message } = req.body as {
    userId: string; subject: string; category: string; priority?: string; message?: string;
  };
  if (!userId || !subject || !category) {
    res.status(400).json({ error: 'userId, subject, and category are required' });
    return;
  }
  const ticket = await prisma.ticket.create({
    data: {
      id: randomBytes(4).toString('hex'),
      userId,
      subject,
      category: category as 'payment' | 'delivery' | 'product' | 'other',
      priority: (priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
      status: 'open',
    },
  });
  if (message?.trim()) {
    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: 'admin',
        senderId: String(req.admin!.adminId),
        message: message.trim(),
        attachments: [],
      },
    });
  }
  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'CREATE_TICKET', targetType: 'ticket', targetId: ticket.id, details: { subject, category } },
  });
  res.status(201).json({ ticket });
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

  emitToUser(ticket.userId, 'ticket:message', { ticketId: ticket.id, message: msg, fromAdmin: true });
  emitToRoom('admin:chat', 'ticket:message', { ticketId: ticket.id, message: msg, fromAdmin: true });

  // Notify the customer by email (Graph/SMTP) and record on the CRM timeline.
  if (req.body.notifyEmail !== false) {
    const user = await prisma.user.findUnique({
      where: { id: ticket.userId },
      select: { email: true },
    });
    if (user?.email) {
      void sendSupportReply(user.email, ticket.subject, ticket.id, String(req.body.message || ''))
        .catch(() => {});
    }
    void logCommunication({
      customerId: ticket.userId,
      channel: 'email',
      direction: 'outbound',
      subject: `Re: ${ticket.subject}`,
      body: String(req.body.message || ''),
      toAddress: user?.email ?? null,
      status: 'sent',
      provider: 'microsoft_graph',
      refType: 'ticket_reply',
      refId: ticket.id,
      adminId: req.admin?.adminId ?? null,
    });
  }

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

  emitToUser(ticket.userId, 'ticket:seen', { ticketId: ticket.id, seenBy: 'admin' });
  emitToRoom('admin:chat', 'ticket:seen', { ticketId: ticket.id, seenBy: 'admin' });

  res.json({ ok: true });
});

// POST /api/admin/tickets/upload — upload file attachment for a ticket
router.post('/upload', memUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  const result = await uploadImage(req.file.buffer, 'oceanbazar/tickets');
  res.json(result);
});

export default router;
