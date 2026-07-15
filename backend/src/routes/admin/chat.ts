/**
 * Admin Live Chat — claim, finish, not-resolved, typing, read receipts, greeting.
 */
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth';
import { routeParam } from '../../utils/params';
import { emitToRoom, emitToUser, emitBroadcast } from '../../lib/adminEvents';

const router = Router();
const prisma = new PrismaClient();
const prismaAny = prisma as any;

function agentMsg(text: string, agentId: number, agentName: string) {
  return {
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: 'agent' as const,
    senderId: String(agentId),
    senderName: agentName,
    message: text,
    timestamp: new Date().toISOString(),
    status: 'sent' as const,
    readAt: null as string | null,
  };
}

async function pushMessages(sessionId: string, newMessages: object[]) {
  const session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  const existing = Array.isArray(session.messages) ? session.messages : [];
  return prismaAny.chat_sessions.update({
    where: { id: sessionId },
    data: { messages: [...existing, ...newMessages], last_message_at: new Date() },
  });
}

// GET /api/admin/chat/sessions — active queue (waiting + active + not_resolved)
router.get('/sessions', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 30;
  const { status } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;
  else where.status = { in: ['waiting_agent', 'active', 'not_resolved'] };

  const [sessions, total] = await Promise.all([
    prismaAny.chat_sessions.findMany({
      where,
      orderBy: { last_message_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prismaAny.chat_sessions.count({ where }),
  ]);
  res.json({ sessions, total, page, limit });
});

// ── GET /api/admin/chat/sessions/all ────────────────────────────────────────
router.get('/sessions/all', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 30;
  const { status } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;

  const [sessions, total] = await Promise.all([
    prismaAny.chat_sessions.findMany({ where, orderBy: { last_message_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prismaAny.chat_sessions.count({ where }),
  ]);
  res.json({ sessions, total, page, limit });
});

// ── GET /api/admin/chat/sessions/:id ────────────────────────────────────────
router.get('/sessions/:id', requireAdmin, async (req: Request, res: Response) => {
  const session = await prismaAny.chat_sessions.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!session) { res.status(404).json({ error: 'Chat session not found' }); return; }
  res.json({ session });
});

// ── POST /api/admin/chat/sessions/:id/claim ──────────────────────────────────
router.post('/sessions/:id/claim', requireAdmin, async (req: Request, res: Response) => {
  const sessionId = routeParam(req.params.id);
  const agentId = req.admin!.adminId;

  const session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (session.status === 'active' && session.agent_id && String(session.agent_id) !== String(agentId)) {
    res.status(409).json({ error: 'Already claimed', claimedBy: session.agent_name });
    return;
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: agentId } });
  const agentName = admin?.name || `Agent #${agentId}`;
  const greeting = admin?.chatGreeting || `Hello! I'm ${agentName} from OceanBazar support. How can I help you today? 😊`;

  const greetingMsg = { id: `a-${Date.now()}`, sender: 'agent', senderId: String(agentId), senderName: agentName, message: greeting, timestamp: new Date().toISOString(), status: 'sent', readAt: null };
  const systemMsg = { id: `sys-${Date.now()}`, sender: 'system', message: `${agentName} has joined the conversation.`, timestamp: new Date().toISOString(), status: 'sent' };

  const existing = Array.isArray(session.messages) ? session.messages : [];
  const updated = await prismaAny.chat_sessions.update({
    where: { id: sessionId },
    data: { status: 'active', agent_id: String(agentId), agent_name: agentName, agent_claimed_at: new Date(), agent_engaged: true, messages: [...existing, systemMsg, greetingMsg], last_message_at: new Date() },
  });

  emitToUser(session.user_id, 'chat:agent_joined', { sessionId, agentName, message: greetingMsg, systemMessage: systemMsg });
  emitToRoom('admin:chat', 'chat:agent_claimed', { sessionId, agentId: String(agentId), agentName, session: updated });
  res.json({ session: updated, claimed: true });
});

// POST /api/admin/chat/sessions/:id/messages
router.post('/sessions/:id/messages', requireAdmin, async (req: Request, res: Response) => {
  const sessionId = routeParam(req.params.id);
  const agentId = req.admin!.adminId;
  const session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (session.status !== 'active') { res.status(400).json({ error: 'Session is not active' }); return; }
  if (String(session.agent_id) !== String(agentId)) { res.status(403).json({ error: 'Not the assigned agent' }); return; }
  const admin = await prisma.adminUser.findUnique({ where: { id: agentId } });
  const agentName = admin?.name || `Agent #${agentId}`;
  const newMsg = agentMsg(req.body.message, agentId, agentName);
  await pushMessages(sessionId, [newMsg]);
  emitToUser(session.user_id, 'chat:message', { sessionId, message: newMsg });
  emitToRoom('admin:chat', 'chat:message', { sessionId, message: newMsg });
  res.status(201).json({ message: newMsg });
});

// POST /api/admin/chat/sessions/:id/finish
router.post('/sessions/:id/finish', requireAdmin, async (req: Request, res: Response) => {
  const sessionId = routeParam(req.params.id);
  const agentId = req.admin!.adminId;
  const session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  const sysMsg = { id: `sys-${Date.now()}`, sender: 'system', message: 'This conversation has been resolved. Thank you for contacting OceanBazar! 😊', timestamp: new Date().toISOString(), status: 'sent' };
  const existing = Array.isArray(session.messages) ? session.messages : [];
  const updated = await prismaAny.chat_sessions.update({
    where: { id: sessionId },
    data: { status: 'finished', is_active: false, resolved_at: new Date(), closed_by_agent_at: new Date(), messages: [...existing, sysMsg], last_message_at: new Date() },
  });
  emitToUser(session.user_id, 'chat:session_finished', { sessionId, message: 'Your support session has been resolved. Thank you! 💙' });
  emitToRoom('admin:chat', 'chat:session_finished', { sessionId, resolvedBy: String(agentId), session: updated });
  res.json({ session: updated, finished: true });
});

// POST /api/admin/chat/sessions/:id/not-resolved
router.post('/sessions/:id/not-resolved', requireAdmin, async (req: Request, res: Response) => {
  const sessionId = routeParam(req.params.id);
  const session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  const sysMsg = { id: `sys-${Date.now()}`, sender: 'system', message: 'The agent was unable to reach you. Your conversation remains open — another agent will assist you shortly.', timestamp: new Date().toISOString(), status: 'sent' };
  const existing = Array.isArray(session.messages) ? session.messages : [];
  const updated = await prismaAny.chat_sessions.update({
    where: { id: sessionId },
    data: { status: 'not_resolved', is_active: true, agent_id: null, agent_name: null, agent_claimed_at: null, agent_engaged: false, messages: [...existing, sysMsg], last_message_at: new Date() },
  });
  emitToUser(session.user_id, 'chat:not_resolved', { sessionId, message: sysMsg.message });
  emitToRoom('admin:chat', 'chat:human_requested', { sessionId, customerName: session.customer_name, customerIssue: session.customer_issue, session: updated, requeued: true });
  emitBroadcast('chat:human_requested', { sessionId, customerName: session.customer_name, requeued: true });
  res.json({ session: updated, requeued: true });
});

// POST /api/admin/chat/sessions/:id/typing
router.post('/sessions/:id/typing', requireAdmin, async (req: Request, res: Response) => {
  const sessionId = routeParam(req.params.id);
  const session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
  if (session) emitToUser(session.user_id, 'chat:agent_typing', { sessionId });
  res.json({ ok: true });
});

// POST /api/admin/chat/sessions/:id/read
router.post('/sessions/:id/read', requireAdmin, async (req: Request, res: Response) => {
  const sessionId = routeParam(req.params.id);
  const session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
  if (!session) { res.status(404).json({ error: 'Not found' }); return; }
  const msgs = Array.isArray(session.messages) ? session.messages : [];
  const now = new Date().toISOString();
  const updated = msgs.map((m: any) => (m.sender === 'user' && !m.readAt ? { ...m, readAt: now, status: 'read' } : m));
  await prismaAny.chat_sessions.update({ where: { id: sessionId }, data: { messages: updated } });
  emitToUser(session.user_id, 'chat:messages_read', { sessionId, readBy: 'agent', at: now });
  res.json({ ok: true });
});

// GET /api/admin/chat/greeting
router.get('/greeting', requireAdmin, async (req: Request, res: Response) => {
  const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.adminId } });
  res.json({ greeting: admin?.chatGreeting || null });
});

// PUT /api/admin/chat/greeting
router.put('/greeting', requireAdmin, async (req: Request, res: Response) => {
  const { greeting } = req.body;
  if (!greeting?.trim()) { res.status(400).json({ error: 'Greeting text required' }); return; }
  const admin = await prisma.adminUser.update({ where: { id: req.admin!.adminId }, data: { chatGreeting: greeting.trim() } });
  res.json({ greeting: admin.chatGreeting });
});

export default router;
