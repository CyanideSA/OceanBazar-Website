import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireRole } from '../../middleware/auth';
import { emailWrapper, sendMail } from '../../services/emailService';
import {
  isConfigured as graphConfigured,
  configuredMailboxes,
  defaultSender,
  listGraphMessages,
  getGraphMessage,
  replyToGraphMessage,
  listGraphFolders,
  moveGraphMessage,
  patchGraphMessageRead,
  listGraphAttachments,
  createGraphDraft,
  STANDARD_FOLDERS,
} from '../../services/microsoftGraphService';
import { v4 as uuidv4 } from 'uuid';
import { logCommunication, resolveCustomerIdByEmail } from '../../services/communicationLogService';

const router = Router();
const prisma = new PrismaClient();

/** GET /api/admin/email/status — provider + configured mailboxes */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    graphConfigured: graphConfigured(),
    smtpConfigured: Boolean(process.env.SMTP_USER),
    mailboxes: configuredMailboxes(),
    defaultSender: defaultSender(),
  });
});

/** GET /api/admin/email/logs — unified communication log (default: email channel) */
router.get('/logs', async (req: Request, res: Response) => {
  const channel = (req.query.channel as string) || 'email';
  const customerId = req.query.customerId as string | undefined;
  const take = Math.min(Math.max(parseInt(String(req.query.limit || '50')), 1), 200);

  const where: Record<string, unknown> = {};
  if (channel !== 'all') where.channel = channel;
  if (customerId) where.customerId = customerId;

  const logs = await prisma.communicationLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
  });
  res.json({ logs });
});

/** GET /api/admin/email/inbox — list messages from a Microsoft 365 shared mailbox */
router.get('/inbox', async (req: Request, res: Response) => {
  if (!graphConfigured()) {
    res.json({ configured: false, messages: [] });
    return;
  }
  try {
    const messages = await listGraphMessages({
      mailbox: req.query.mailbox as string | undefined,
      folder: (req.query.folder as string) || 'Inbox',
      top: parseInt(String(req.query.top || '25')),
      search: req.query.search as string | undefined,
    });
    res.json({ configured: true, messages });
  } catch (err: any) {
    res.status(502).json({ error: 'graph_inbox_failed', detail: err?.message });
  }
});

/** GET /api/admin/email/message/:id — full message body */
router.get('/message/:id', async (req: Request, res: Response) => {
  if (!graphConfigured()) {
    res.status(409).json({ error: 'graph_not_configured' });
    return;
  }
  try {
    const message = await getGraphMessage(req.query.mailbox as string | undefined, String(req.params.id));
    if (!message) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    // Log inbound message read so it appears on the customer timeline.
    const customerId = await resolveCustomerIdByEmail(message.from);
    await logCommunication({
      customerId,
      channel: 'email',
      direction: 'inbound',
      subject: message.subject,
      fromAddress: message.from,
      status: 'read',
      provider: 'microsoft_graph',
      externalId: message.id,
      refType: 'graph_message',
      refId: message.conversationId,
      adminId: req.admin?.adminId ?? null,
    });
    res.json({ message });
  } catch (err: any) {
    res.status(502).json({ error: 'graph_message_failed', detail: err?.message });
  }
});

/** POST /api/admin/email/send — compose + send a new email */
router.post(
  '/send',
  requireRole('super_admin', 'admin', 'support', 'staff'),
  async (req: Request, res: Response) => {
    const { to, subject, body, from } = req.body || {};
    if (!to || !subject || !body) {
      res.status(400).json({ error: 'to, subject and body are required' });
      return;
    }
    const html = emailWrapper(`<div style="font-size:15px;color:#374151;line-height:1.6;">${body}</div>`);
    const ok = await sendMail(String(to), String(subject), html, 'admin_compose', { from });

    const customerId = await resolveCustomerIdByEmail(String(to));
    await logCommunication({
      customerId,
      channel: 'email',
      direction: 'outbound',
      subject: String(subject),
      body: String(body),
      toAddress: String(to),
      fromAddress: from || defaultSender(),
      status: ok ? 'sent' : 'failed',
      provider: graphConfigured() ? 'microsoft_graph' : 'smtp',
      refType: 'admin_compose',
      adminId: req.admin?.adminId ?? null,
    });

    if (!ok) {
      res.status(502).json({ error: 'send_failed' });
      return;
    }
    res.json({ ok: true });
  }
);

/** POST /api/admin/email/reply/:id — reply in-thread to a mailbox message */
router.post(
  '/reply/:id',
  requireRole('super_admin', 'admin', 'support', 'staff'),
  async (req: Request, res: Response) => {
    if (!graphConfigured()) {
      res.status(409).json({ error: 'graph_not_configured' });
      return;
    }
    const { body, mailbox } = req.body || {};
    if (!body) {
      res.status(400).json({ error: 'body is required' });
      return;
    }
    const html = emailWrapper(`<div style="font-size:15px;color:#374151;line-height:1.6;">${body}</div>`);
    const result = await replyToGraphMessage({ mailbox, messageId: String(req.params.id), html });
    await logCommunication({
      channel: 'email',
      direction: 'outbound',
      body: String(body),
      fromAddress: result.sender,
      status: result.ok ? 'sent' : 'failed',
      provider: 'microsoft_graph',
      externalId: String(req.params.id),
      refType: 'graph_reply',
      adminId: req.admin?.adminId ?? null,
    });
    if (!result.ok) {
      res.status(502).json({ error: 'reply_failed', detail: result.error });
      return;
    }
    res.json({ ok: true });
  }
);

/** GET /api/admin/email/folders */
router.get('/folders', async (req: Request, res: Response) => {
  if (!graphConfigured()) { res.json({ configured: false, folders: [] }); return; }
  const folders = await listGraphFolders(req.query.mailbox as string | undefined);
  res.json({ configured: true, folders, standardFolders: STANDARD_FOLDERS });
});

/** POST /api/admin/email/message/:id/move — move to spam/inbox */
router.post('/message/:id/move', async (req: Request, res: Response) => {
  const { destinationFolderId, mailbox } = req.body || {};
  if (!destinationFolderId) { res.status(400).json({ error: 'destinationFolderId required' }); return; }
  const ok = await moveGraphMessage({ mailbox, messageId: String(req.params.id), destinationFolderId });
  res.json({ ok });
});

/** PATCH /api/admin/email/message/:id/read */
router.patch('/message/:id/read', async (req: Request, res: Response) => {
  const { isRead = true, mailbox } = req.body || {};
  const ok = await patchGraphMessageRead({ mailbox, messageId: String(req.params.id), isRead: Boolean(isRead) });
  res.json({ ok });
});

/** GET /api/admin/email/message/:id/attachments */
router.get('/message/:id/attachments', async (req: Request, res: Response) => {
  const attachments = await listGraphAttachments(req.query.mailbox as string | undefined, String(req.params.id));
  res.json({ attachments });
});

/** POST /api/admin/email/draft — save local + Graph draft */
router.post('/draft', async (req: Request, res: Response) => {
  const { mailbox, to, subject, body, cc, bcc } = req.body || {};
  if (!to) { res.status(400).json({ error: 'to required' }); return; }
  const prismaAny = prisma as any;
  const local = await prismaAny.email_drafts.create({
    data: {
      id: uuidv4(),
      mailbox: mailbox || defaultSender(),
      to_address: String(to),
      cc: cc || null,
      bcc: bcc || null,
      subject: subject || null,
      body_html: body || null,
      created_by: String(req.admin?.adminId || 'admin'),
    },
  });
  let graphDraftId: string | undefined;
  if (graphConfigured() && body) {
    const r = await createGraphDraft({ mailbox, to: String(to), subject: String(subject || ''), html: String(body), cc });
    graphDraftId = r.draftId;
  }
  res.status(201).json({ draft: local, graphDraftId });
});

/** GET /api/admin/email/drafts — local draft cache */
router.get('/drafts', async (_req: Request, res: Response) => {
  const prismaAny = prisma as any;
  const drafts = await prismaAny.email_drafts.findMany({ orderBy: { updated_at: 'desc' }, take: 50 });
  res.json({ drafts });
});

export default router;
