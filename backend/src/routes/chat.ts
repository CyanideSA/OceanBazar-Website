/**
 * Storefront Live Chat — BFF-native (Node.js Socket.IO, NOT proxied to Java).
 * Handles session start, message sending (bot + human), escalation, typing, close.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import { optionalAuth, requireAuth } from '../middleware/auth';
import { generateEntityId } from '../utils/hexId';
import { getWelcomeMessages, processMessage, processAction } from '../services/chatbotService';
import { parseBotContext } from '../services/chat/chatEngine';
import { emitToRoom, emitToUser, emitBroadcast } from '../lib/adminEvents';

const router = Router();
const prismaAny = prisma as any;

/* ── helpers ──────────────────────────────────────────────────────────────── */

function userMsg(text: string, senderId: string, senderName?: string) {
  return {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: 'user' as const,
    senderId,
    senderName: senderName || 'Customer',
    message: text,
    timestamp: new Date().toISOString(),
    status: 'sent' as const,
    readAt: null as string | null,
  };
}

function systemMsg(text: string) {
  return {
    id: `sys-${Date.now()}`,
    sender: 'system' as const,
    message: text,
    timestamp: new Date().toISOString(),
    status: 'sent' as const,
  };
}

async function pushAndSave(sessionId: string, newMessages: object[]) {
  const session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  const existing = Array.isArray(session.messages) ? session.messages : [];
  const merged = [...existing, ...newMessages];
  return prismaAny.chat_sessions.update({
    where: { id: sessionId },
    data: { messages: merged, last_message_at: new Date() },
  });
}

/* ── POST /api/chat/start ─────────────────────────────────────────────────── */
// Start or resume a chat session. Works for both logged-in users and visitors.
router.post('/start', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { name, email, phone, issue, visitorId } = req.body;
    const userId: string = (req as any).user?.userId ?? visitorId ?? `visitor-${generateEntityId()}`;
    const customerName = name || 'Guest';

    // Resume existing active session
    let session = await prismaAny.chat_sessions.findFirst({
      where: { user_id: userId, is_active: true, status: { not: 'finished' } },
      orderBy: { last_message_at: 'desc' },
    });

    if (!session) {
      const welcomeMsgs = getWelcomeMessages(customerName);
      session = await prismaAny.chat_sessions.create({
        data: {
          id: generateEntityId(),
          user_id: userId,
          visitor_id: (req as any).user ? null : userId,
          customer_name: customerName,
          customer_email: email || (req as any).user?.email || null,
          customer_phone: phone || null,
          customer_issue: issue || null,
          customer_form: { name, email, phone, issue },
          status: 'bot',
          channel: 'web',
          messages: welcomeMsgs,
          bot_context: { memory: [], flow: null, step: 0, slots: {} },
          is_active: true,
          agent_engaged: false,
        },
      });
    }

    res.json({ session });
  } catch (err) {
    console.error('[chat/start]', err);
    res.status(500).json({ error: 'Failed to start chat session' });
  }
});

/* ── GET /api/chat/session ────────────────────────────────────────────────── */
router.get('/session', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId: string | undefined = (req as any).user?.userId ?? (req.query.visitorId as string);
    if (!userId) { res.json({ session: null }); return; }

    const session = await prismaAny.chat_sessions.findFirst({
      where: { user_id: userId, is_active: true, status: { not: 'finished' } },
      orderBy: { last_message_at: 'desc' },
    });
    res.json({ session });
  } catch {
    res.json({ session: null });
  }
});

/* ── POST /api/chat/claim-visitor ─────────────────────────────────────────── */
// Move a pre-login visitor conversation onto the authenticated account.
router.post('/claim-visitor', requireAuth, async (req: Request, res: Response) => {
  try {
    const visitorId = String(req.body?.visitorId || '').trim();
    if (!visitorId) { res.json({ session: null, claimed: false }); return; }

    const userId = req.user!.userId;
    const [visitorSession, accountSession, user] = await Promise.all([
      prismaAny.chat_sessions.findFirst({
        where: {
          visitor_id: visitorId,
          user_id: visitorId,
          is_active: true,
          status: { not: 'finished' },
        },
        orderBy: { last_message_at: 'desc' },
      }),
      prismaAny.chat_sessions.findFirst({
        where: { user_id: userId, is_active: true, status: { not: 'finished' } },
        orderBy: { last_message_at: 'desc' },
      }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!visitorSession) {
      res.json({ session: accountSession, claimed: false });
      return;
    }

    if (accountSession && accountSession.id !== visitorSession.id) {
      const existing = Array.isArray(accountSession.messages) ? accountSession.messages : [];
      const incoming = Array.isArray(visitorSession.messages) ? visitorSession.messages : [];
      const seen = new Set(existing.map((m: any) => String(m?.id || '')));
      const merged = [...existing, ...incoming.filter((m: any) => !seen.has(String(m?.id || '')))]
        .sort((a: any, b: any) => String(a?.timestamp || '').localeCompare(String(b?.timestamp || '')));

      const session = await prismaAny.$transaction(async (tx: any) => {
        const updated = await tx.chat_sessions.update({
          where: { id: accountSession.id },
          data: {
            messages: merged,
            visitor_id: visitorId,
            customer_name: user?.name || accountSession.customer_name,
            customer_email: user?.email || accountSession.customer_email,
            customer_phone: user?.phone || accountSession.customer_phone,
            last_message_at: new Date(),
          },
        });
        await tx.chat_sessions.update({
          where: { id: visitorSession.id },
          data: { is_active: false, status: 'finished', resolved_at: new Date() },
        });
        return updated;
      });
      res.json({ session, claimed: true, merged: true });
      return;
    }

    const session = await prismaAny.chat_sessions.update({
      where: { id: visitorSession.id },
      data: {
        user_id: userId,
        visitor_id: visitorId,
        customer_name: user?.name || visitorSession.customer_name,
        customer_email: user?.email || visitorSession.customer_email,
        customer_phone: user?.phone || visitorSession.customer_phone,
      },
    });
    res.json({ session, claimed: true, merged: false });
  } catch (err) {
    console.error('[chat/claim-visitor]', err);
    res.status(500).json({ error: 'Failed to move visitor conversation' });
  }
});

/* ── POST /api/chat/message ───────────────────────────────────────────────── */
router.post('/message', optionalAuth, async (req: Request, res: Response) => {
  try {
    let { sessionId, message, visitorId } = req.body;
    const userId: string = (req as any).user?.userId ?? visitorId;
    if (!userId || !message?.trim()) { res.status(400).json({ error: 'Missing fields' }); return; }

    // Auto-find active session if sessionId not provided
    let session: any = null;
    if (sessionId) {
      session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
    }
    if (!session) {
      session = await prismaAny.chat_sessions.findFirst({
        where: { user_id: userId, is_active: true, status: { not: 'finished' } },
        orderBy: { last_message_at: 'desc' },
      });
    }
    if (!session || session.user_id !== userId) { res.status(404).json({ error: 'Session not found' }); return; }
    sessionId = session.id;

    const uMsg = userMsg(message.trim(), userId, session.customer_name);
    const toAdd: object[] = [uMsg];
    let botReply = null;
    let escalated = false;

    // Bot mode: process with unified chat engine
    let contextPatch = parseBotContext(session.bot_context);
    if (session.status === 'bot') {
      const result = await processMessage({
        session,
        text: message.trim(),
        userId,
        isAuthenticated: Boolean((req as any).user?.userId),
        userName: session.customer_name || undefined,
      });
      for (const m of result.messages) {
        botReply = m;
        toAdd.push(m);
      }
      contextPatch = result.contextPatch as typeof contextPatch;
      if (result.escalate) escalated = true;
    }

    const updated = await pushAndSave(sessionId, toAdd);
    if (session.status === 'bot') {
      await prismaAny.chat_sessions.update({
        where: { id: sessionId },
        data: { bot_context: contextPatch },
      });
    }

    // Emit every customer message to the admin room so the CRM chat list and
    // any open thread stay in sync (bot/waiting sessions included).
    emitToRoom('admin:chat', 'chat:message', {
      sessionId,
      message: uMsg,
      session: { id: sessionId, customer_name: session.customer_name, customer_issue: session.customer_issue, status: session.status },
    });

    // Handle escalation: transition to waiting_agent
    if (escalated) {
      await prismaAny.chat_sessions.update({
        where: { id: sessionId },
        data: { status: 'waiting_agent', agent_engaged: false },
      });

      const sysMsg = systemMsg('You have been connected to our support queue. A human agent will join you shortly. Thank you for your patience! 🙏');
      await pushAndSave(sessionId, [sysMsg]);

      // Notify ALL admins
      const fullSession = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
      emitToRoom('admin:chat', 'chat:human_requested', {
        sessionId,
        customerName: session.customer_name,
        customerIssue: session.customer_issue,
        session: fullSession,
      });
      // Also broadcast so non-room admins pick it up
      emitBroadcast('chat:human_requested', {
        sessionId,
        customerName: session.customer_name,
        customerIssue: session.customer_issue,
      });

      res.json({ message: uMsg, botReply, escalated: true, session: fullSession });
      return;
    }

    res.json({ message: uMsg, botReply, escalated: false, session: updated });
  } catch (err) {
    console.error('[chat/message]', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/* ── POST /api/chat/action ────────────────────────────────────────────────── */
router.post('/action', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId, action, payload, visitorId, productId, quantity } = req.body;
    const userId: string = (req as any).user?.userId ?? visitorId;
    if (!userId || !action) { res.status(400).json({ error: 'Missing fields' }); return; }

    let session: any = sessionId
      ? await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } })
      : await prismaAny.chat_sessions.findFirst({
          where: { user_id: userId, is_active: true, status: { not: 'finished' } },
          orderBy: { last_message_at: 'desc' },
        });
    if (!session || session.user_id !== userId) { res.status(404).json({ error: 'Session not found' }); return; }

    const actionKey = String(action).toLowerCase().replace(/\s+/g, '_');
    const mergedPayload: Record<string, unknown> = {
      ...(payload && typeof payload === 'object' ? payload : {}),
    };
    if (productId && !mergedPayload.productId) mergedPayload.productId = productId;
    if (quantity != null && mergedPayload.quantity == null) mergedPayload.quantity = quantity;

    // #region agent log
    try {
      const fs = await import('fs');
      const path = await import('path');
      fs.appendFileSync(
        path.resolve(__dirname, '../../../debug-1eb282.log'),
        `${JSON.stringify({
          sessionId: '1eb282',
          runId: 'pre-fix',
          hypothesisId: 'H6',
          location: 'chat.ts:/action',
          message: 'chat action received',
          data: { actionKey, hasProductId: Boolean(mergedPayload.productId) },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion

    const result = await processAction({
      session,
      action: actionKey,
      payload: mergedPayload,
      userId,
      isAuthenticated: Boolean((req as any).user?.userId),
      userName: session.customer_name || undefined,
    });

    const toAdd: object[] = [...result.messages];
    await pushAndSave(session.id, toAdd);
    await prismaAny.chat_sessions.update({
      where: { id: session.id },
      data: { bot_context: result.contextPatch },
    });

    if (result.escalate && session.status === 'bot') {
      await prismaAny.chat_sessions.update({
        where: { id: session.id },
        data: { status: 'waiting_agent', agent_engaged: false },
      });
      const sysMsg = systemMsg('You have been connected to our support queue. A human agent will join you shortly.');
      await pushAndSave(session.id, [sysMsg]);
      emitToRoom('admin:chat', 'chat:human_requested', {
        sessionId: session.id,
        customerName: session.customer_name,
        customerIssue: session.customer_issue,
      });
      emitBroadcast('chat:human_requested', { sessionId: session.id, customerName: session.customer_name });
      res.json({
        messages: result.messages,
        escalated: true,
        session: await prismaAny.chat_sessions.findUnique({ where: { id: session.id } }),
      });
      return;
    }

    res.json({
      messages: result.messages,
      escalated: false,
      session: await prismaAny.chat_sessions.findUnique({ where: { id: session.id } }),
    });
  } catch (err) {
    console.error('[chat/action]', err);
    res.status(500).json({ error: 'Failed to process action' });
  }
});

/* ── POST /api/chat/escalate ──────────────────────────────────────────────── */
// Explicit escalation request (button click, not text-based)
router.post('/escalate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId, visitorId } = req.body;
    const userId: string = (req as any).user?.userId ?? visitorId;

    const session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
    if (!session || session.user_id !== userId) { res.status(404).json({ error: 'Not found' }); return; }
    if (session.status !== 'bot') { res.json({ session }); return; }

    const botApology = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      message: "I'm connecting you with a human agent now. Please hold on — someone from our team will join you shortly! 🙏",
      timestamp: new Date().toISOString(),
      status: 'sent',
    };
    const sysMsg2 = systemMsg('You are now in the support queue. Our next available agent will connect with you soon.');

    await pushAndSave(sessionId, [botApology, sysMsg2]);
    const updated = await prismaAny.chat_sessions.update({
      where: { id: sessionId },
      data: { status: 'waiting_agent', agent_engaged: false },
    });

    emitToRoom('admin:chat', 'chat:human_requested', {
      sessionId,
      customerName: session.customer_name,
      customerIssue: session.customer_issue,
      session: updated,
    });
    emitBroadcast('chat:human_requested', { sessionId, customerName: session.customer_name });

    res.json({ session: updated, queued: true });
  } catch (err) {
    console.error('[chat/escalate]', err);
    res.status(500).json({ error: 'Failed to escalate' });
  }
});

/* ── POST /api/chat/typing ────────────────────────────────────────────────── */
router.post('/typing', optionalAuth, async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  const session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
  if (session?.agent_id) {
    emitToRoom('admin:chat', 'chat:customer_typing', { sessionId });
  }
  res.json({ ok: true });
});

/* ── POST /api/chat/read ──────────────────────────────────────────────────── */
// Customer marks agent messages as read
router.post('/read', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId, visitorId } = req.body;
    const userId: string = (req as any).user?.userId ?? visitorId;
    const session = await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } });
    if (!session || session.user_id !== userId) { res.status(404).json({ error: 'Not found' }); return; }

    const messages = Array.isArray(session.messages) ? session.messages : [];
    const now = new Date().toISOString();
    const updated = messages.map((m: any) => {
      if ((m.sender === 'agent' || m.sender === 'admin') && !m.readAt) return { ...m, readAt: now, status: 'read' };
      return m;
    });
    await prismaAny.chat_sessions.update({ where: { id: sessionId }, data: { messages: updated } });

    if (session.agent_id) {
      emitToRoom('admin:chat', 'chat:messages_read', { sessionId, readBy: 'customer', at: now });
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

/* ── POST /api/chat/session/close ─────────────────────────────────────────── */
router.post('/session/close', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId, visitorId } = req.body;
    const userId: string = (req as any).user?.userId ?? visitorId;
    let session = sessionId
      ? await prismaAny.chat_sessions.findUnique({ where: { id: sessionId } })
      : null;
    if (!session && userId) {
      session = await prismaAny.chat_sessions.findFirst({
        where: { user_id: userId, is_active: true, status: { not: 'finished' } },
        orderBy: { last_message_at: 'desc' },
      });
    }
    if (!session || session.user_id !== userId) { res.status(404).json({ error: 'Not found' }); return; }

    await prismaAny.chat_sessions.update({
      where: { id: session.id },
      data: { is_active: false, status: 'finished', closed_by_agent_at: new Date(), resolved_at: new Date() },
    });

    if (session.agent_id) {
      emitToRoom('admin:chat', 'chat:session_closed_by_customer', { sessionId: session.id });
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to close session' });
  }
});

export default router;
