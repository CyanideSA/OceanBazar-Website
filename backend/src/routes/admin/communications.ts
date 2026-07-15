import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { routeParam } from '../../utils/params';

const router = Router();
const prisma = new PrismaClient();
const prismaAny = prisma as any;

router.get('/timeline/:customerId', async (req: Request, res: Response) => {
  const customerId = routeParam(req.params.customerId);
  if (!customerId) {
    res.status(400).json({ error: 'customerId required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, email: true, phone: true },
  });
  if (!user) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const emailOrConditions = [
    { customerId },
    ...(user.email
      ? [
          { toAddress: { equals: user.email, mode: 'insensitive' as const } },
          { fromAddress: { equals: user.email, mode: 'insensitive' as const } },
        ]
      : []),
    ...(user.phone
      ? [{ toAddress: { contains: user.phone.replace(/\D/g, '').slice(-10) } }]
      : []),
  ];

  const [commLogs, chatSessions, tickets] = await Promise.all([
    prisma.communicationLog.findMany({
      where: { OR: emailOrConditions },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prismaAny.chat_sessions.findMany({
      where: {
        OR: [
          { user_id: customerId },
          { visitor_id: { contains: customerId } },
        ],
        is_active: true,
      },
      orderBy: { last_message_at: 'desc' },
      take: 20,
    }),
    prisma.ticket.findMany({
      where: { userId: customerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { messages: { take: 3, orderBy: { createdAt: 'desc' } } },
    }),
  ]);

  const chatEvents = chatSessions.flatMap((s: {
    id: string;
    channel: string;
    customer_name: string;
    messages: unknown;
    last_message_at: Date;
  }) => {
    const msgs = Array.isArray(s.messages) ? s.messages : [];
    const last = msgs[msgs.length - 1] as { message?: string; sender?: string; timestamp?: string } | undefined;
    return [{
      type: 'chat',
      channel: s.channel || 'web',
      sessionId: s.id,
      customerName: s.customer_name,
      preview: last?.message || '',
      sender: last?.sender,
      at: s.last_message_at,
    }];
  });

  const timeline = [
    ...commLogs.map((c) => ({
      type: 'communication',
      channel: c.channel,
      direction: c.direction,
      subject: c.subject,
      body: c.body?.slice(0, 500),
      fromAddress: c.fromAddress,
      toAddress: c.toAddress,
      status: c.status,
      provider: c.provider,
      at: c.createdAt,
    })),
    ...chatEvents,
    ...tickets.map((t) => ({
      type: 'ticket',
      channel: 'ticket',
      ticketId: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      preview: t.messages[0]?.message?.slice(0, 200),
      at: t.createdAt,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  res.json({ customer: user, timeline, counts: { communications: commLogs.length, chats: chatSessions.length, tickets: tickets.length } });
});

router.get('/timeline/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q || q.length < 2) {
    res.status(400).json({ error: 'query too short' });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { name: { contains: q, mode: 'insensitive' } },
        { id: q },
      ],
    },
    take: 20,
    select: { id: true, name: true, email: true, phone: true },
  });

  res.json({ customers: users });
});

export default router;
