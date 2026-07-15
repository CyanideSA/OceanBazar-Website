import axios from 'axios';

/**
 * Microsoft 365 (Graph API) integration using the OAuth2 client-credentials flow.
 *
 * Required env (Azure AD app registration with Application permission `Mail.Send`,
 * and `Mail.Read` / `Mail.ReadWrite` for shared-mailbox reading, granted admin consent):
 *   MS_TENANT_ID         Directory (tenant) ID
 *   MS_CLIENT_ID         Application (client) ID
 *   MS_CLIENT_SECRET     Client secret value
 *   MS_SENDER_ADDRESSES  Comma-separated allowed shared mailboxes
 *                        (e.g. no-reply@oceanbazar.com.bd,support@oceanbazar.com.bd)
 *   MS_DEFAULT_SENDER    Default From address (defaults to first of MS_SENDER_ADDRESSES)
 *
 * When credentials are absent the service reports `isConfigured() === false` and callers
 * transparently fall back to SMTP (see emailService.ts).
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function senderAddresses(): string[] {
  return (process.env.MS_SENDER_ADDRESSES || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isConfigured(): boolean {
  return Boolean(
    process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET
  );
}

export function defaultSender(): string {
  const explicit = process.env.MS_DEFAULT_SENDER?.trim().toLowerCase();
  if (explicit) return explicit;
  const list = senderAddresses();
  return list[0] || 'no-reply@oceanbazar.com.bd';
}

/** Resolves the mailbox to act on, defaulting to the configured default sender. */
function resolveMailbox(address?: string): string {
  const candidate = address?.trim().toLowerCase();
  const allowed = senderAddresses();
  if (candidate && (allowed.length === 0 || allowed.includes(candidate))) return candidate;
  return defaultSender();
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const tenant = process.env.MS_TENANT_ID!;
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    client_secret: process.env.MS_CLIENT_SECRET!,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const { data } = await axios.post(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15_000,
  });
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  return cachedToken.token;
}

export interface GraphSendResult {
  ok: boolean;
  sender: string;
  error?: string;
}

/**
 * Sends an HTML email through a Microsoft 365 shared mailbox.
 * Returns ok=false (never throws) so callers can fall back to SMTP.
 */
export async function sendGraphMail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  cc?: string[];
  replyTo?: string;
}): Promise<GraphSendResult> {
  const sender = resolveMailbox(opts.from);
  if (!isConfigured()) return { ok: false, sender, error: 'graph_not_configured' };
  try {
    const token = await getAccessToken();
    const message = {
      subject: opts.subject,
      body: { contentType: 'HTML', content: opts.html },
      toRecipients: [{ emailAddress: { address: opts.to } }],
      ...(opts.cc?.length
        ? { ccRecipients: opts.cc.map((c) => ({ emailAddress: { address: c } })) }
        : {}),
      ...(opts.replyTo
        ? { replyTo: [{ emailAddress: { address: opts.replyTo } }] }
        : {}),
    };
    await axios.post(
      `${GRAPH_BASE}/users/${encodeURIComponent(sender)}/sendMail`,
      { message, saveToSentItems: true },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 20_000,
      }
    );
    return { ok: true, sender };
  } catch (err: any) {
    const detail = err?.response?.data?.error?.message || err?.message || 'unknown';
    console.error('[graph] sendMail failed:', detail);
    return { ok: false, sender, error: detail };
  }
}

export interface GraphMessage {
  id: string;
  subject: string;
  from: string;
  fromName: string;
  preview: string;
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  conversationId: string;
}

function mapMessage(m: any): GraphMessage {
  return {
    id: m.id,
    subject: m.subject || '(no subject)',
    from: m.from?.emailAddress?.address || '',
    fromName: m.from?.emailAddress?.name || '',
    preview: m.bodyPreview || '',
    receivedAt: m.receivedDateTime,
    isRead: Boolean(m.isRead),
    hasAttachments: Boolean(m.hasAttachments),
    conversationId: m.conversationId || '',
  };
}

/** Lists recent messages from a shared mailbox folder (default Inbox). */
export async function listGraphMessages(opts: {
  mailbox?: string;
  folder?: string;
  top?: number;
  search?: string;
}): Promise<GraphMessage[]> {
  if (!isConfigured()) return [];
  const mailbox = resolveMailbox(opts.mailbox);
  const folder = opts.folder || 'Inbox';
  const top = Math.min(Math.max(opts.top || 25, 1), 100);
  const token = await getAccessToken();
  const query: Record<string, string> = {
    $top: String(top),
    $select: 'id,subject,from,bodyPreview,receivedDateTime,isRead,hasAttachments,conversationId',
    $orderby: 'receivedDateTime desc',
  };
  if (opts.search) query['$search'] = `"${opts.search}"`;
  const { data } = await axios.get(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/mailFolders/${encodeURIComponent(folder)}/messages`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts.search ? { ConsistencyLevel: 'eventual' } : {}),
      },
      params: query,
      timeout: 20_000,
    }
  );
  return (data.value || []).map(mapMessage);
}

/** Fetches a single message with full HTML body. */
export async function getGraphMessage(mailbox: string | undefined, messageId: string): Promise<
  (GraphMessage & { bodyHtml: string }) | null
> {
  if (!isConfigured()) return null;
  const box = resolveMailbox(mailbox);
  const token = await getAccessToken();
  const { data } = await axios.get(
    `${GRAPH_BASE}/users/${encodeURIComponent(box)}/messages/${encodeURIComponent(messageId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { $select: 'id,subject,from,body,bodyPreview,receivedDateTime,isRead,hasAttachments,conversationId' },
      timeout: 20_000,
    }
  );
  return { ...mapMessage(data), bodyHtml: data.body?.content || '' };
}

/** Replies to a message in-thread from the shared mailbox. */
export async function replyToGraphMessage(opts: {
  mailbox?: string;
  messageId: string;
  html: string;
}): Promise<GraphSendResult> {
  const sender = resolveMailbox(opts.mailbox);
  if (!isConfigured()) return { ok: false, sender, error: 'graph_not_configured' };
  try {
    const token = await getAccessToken();
    await axios.post(
      `${GRAPH_BASE}/users/${encodeURIComponent(sender)}/messages/${encodeURIComponent(opts.messageId)}/reply`,
      { message: { body: { contentType: 'HTML', content: opts.html } } },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 20_000,
      }
    );
    return { ok: true, sender };
  } catch (err: any) {
    const detail = err?.response?.data?.error?.message || err?.message || 'unknown';
    console.error('[graph] reply failed:', detail);
    return { ok: false, sender, error: detail };
  }
}

export function configuredMailboxes(): string[] {
  return senderAddresses();
}

export interface GraphFolder {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}

/** Lists mail folders for a mailbox (Inbox, SentItems, Drafts, JunkEmail, etc.). */
export async function listGraphFolders(mailbox?: string): Promise<GraphFolder[]> {
  if (!isConfigured()) return [];
  const box = resolveMailbox(mailbox);
  const token = await getAccessToken();
  const { data } = await axios.get(
    `${GRAPH_BASE}/users/${encodeURIComponent(box)}/mailFolders`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { $top: 50, $select: 'id,displayName,totalItemCount,unreadItemCount' },
      timeout: 20_000,
    },
  );
  return (data.value || []).map((f: any) => ({
    id: f.id,
    displayName: f.displayName,
    totalItemCount: f.totalItemCount ?? 0,
    unreadItemCount: f.unreadItemCount ?? 0,
  }));
}

/** Moves a message to another folder (e.g. JunkEmail for spam). */
export async function moveGraphMessage(opts: {
  mailbox?: string;
  messageId: string;
  destinationFolderId: string;
}): Promise<boolean> {
  if (!isConfigured()) return false;
  const box = resolveMailbox(opts.mailbox);
  try {
    const token = await getAccessToken();
    await axios.post(
      `${GRAPH_BASE}/users/${encodeURIComponent(box)}/messages/${encodeURIComponent(opts.messageId)}/move`,
      { destinationId: opts.destinationFolderId },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15_000 },
    );
    return true;
  } catch (err: any) {
    console.error('[graph] move failed:', err?.response?.data?.error?.message || err?.message);
    return false;
  }
}

/** Mark message read/unread. */
export async function patchGraphMessageRead(opts: {
  mailbox?: string;
  messageId: string;
  isRead: boolean;
}): Promise<boolean> {
  if (!isConfigured()) return false;
  const box = resolveMailbox(opts.mailbox);
  try {
    const token = await getAccessToken();
    await axios.patch(
      `${GRAPH_BASE}/users/${encodeURIComponent(box)}/messages/${encodeURIComponent(opts.messageId)}`,
      { isRead: opts.isRead },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15_000 },
    );
    return true;
  } catch {
    return false;
  }
}

/** List attachments metadata for a message. */
export async function listGraphAttachments(mailbox: string | undefined, messageId: string): Promise<
  Array<{ id: string; name: string; contentType: string; size: number }>
> {
  if (!isConfigured()) return [];
  const box = resolveMailbox(mailbox);
  const token = await getAccessToken();
  const { data } = await axios.get(
    `${GRAPH_BASE}/users/${encodeURIComponent(box)}/messages/${encodeURIComponent(messageId)}/attachments`,
    { headers: { Authorization: `Bearer ${token}` }, params: { $select: 'id,name,contentType,size' }, timeout: 15_000 },
  );
  return (data.value || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    contentType: a.contentType,
    size: a.size ?? 0,
  }));
}

/** Create a draft message in Drafts folder. */
export async function createGraphDraft(opts: {
  mailbox?: string;
  to: string;
  subject: string;
  html: string;
  cc?: string[];
}): Promise<{ ok: boolean; draftId?: string; error?: string }> {
  const sender = resolveMailbox(opts.mailbox);
  if (!isConfigured()) return { ok: false, error: 'graph_not_configured' };
  try {
    const token = await getAccessToken();
    const { data } = await axios.post(
      `${GRAPH_BASE}/users/${encodeURIComponent(sender)}/messages`,
      {
        subject: opts.subject,
        body: { contentType: 'HTML', content: opts.html },
        toRecipients: [{ emailAddress: { address: opts.to } }],
        ...(opts.cc?.length ? { ccRecipients: opts.cc.map((c) => ({ emailAddress: { address: c } })) } : {}),
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 20_000 },
    );
    return { ok: true, draftId: data.id };
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.error?.message || err?.message };
  }
}

/** Standard folder names for Outlook-style UI. */
export const STANDARD_FOLDERS = ['Inbox', 'SentItems', 'Drafts', 'JunkEmail'] as const;

/** List organization users (directory). Requires User.Read.All application permission. */
export async function listDirectoryUsers(top = 50): Promise<Array<{
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
}>> {
  if (!isConfigured()) return [];
  try {
    const token = await getAccessToken();
    const { data } = await axios.get(`${GRAPH_BASE}/users`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { $top: top, $select: 'id,displayName,mail,userPrincipalName' },
      timeout: 15_000,
    });
    return (data.value || []).map((u: { id: string; displayName: string; mail?: string; userPrincipalName: string }) => ({
      id: u.id,
      displayName: u.displayName,
      mail: u.mail || null,
      userPrincipalName: u.userPrincipalName,
    }));
  } catch (err: unknown) {
    console.error('[graph] listDirectoryUsers:', (err as Error)?.message);
    return [];
  }
}

/** Create a calendar event on a shared mailbox calendar. */
export async function createCalendarEvent(opts: {
  mailbox?: string;
  subject: string;
  body?: string;
  start: string;
  end: string;
  attendees?: string[];
}): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  if (!isConfigured()) return { ok: false, error: 'graph_not_configured' };
  const box = resolveMailbox(opts.mailbox);
  try {
    const token = await getAccessToken();
    const { data } = await axios.post(
      `${GRAPH_BASE}/users/${encodeURIComponent(box)}/calendar/events`,
      {
        subject: opts.subject,
        body: { contentType: 'HTML', content: opts.body || '' },
        start: { dateTime: opts.start, timeZone: 'Asia/Dhaka' },
        end: { dateTime: opts.end, timeZone: 'Asia/Dhaka' },
        attendees: (opts.attendees || []).map((a) => ({
          emailAddress: { address: a },
          type: 'required',
        })),
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 20_000 },
    );
    return { ok: true, eventId: data.id };
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data?.error?.message || (err as Error)?.message;
    return { ok: false, error: msg };
  }
}

/** Upload a file to OneDrive/SharePoint (app-only, user's drive by mailbox UPN). */
export async function uploadDriveFile(opts: {
  mailbox?: string;
  fileName: string;
  content: Buffer;
  folderPath?: string;
}): Promise<{ ok: boolean; webUrl?: string; error?: string }> {
  if (!isConfigured()) return { ok: false, error: 'graph_not_configured' };
  const box = resolveMailbox(opts.mailbox);
  const path = opts.folderPath ? `${opts.folderPath}/${opts.fileName}` : opts.fileName;
  try {
    const token = await getAccessToken();
    const { data } = await axios.put(
      `${GRAPH_BASE}/users/${encodeURIComponent(box)}/drive/root:/${path}:/content`,
      opts.content,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
        timeout: 60_000,
        maxBodyLength: Infinity,
      },
    );
    return { ok: true, webUrl: data.webUrl };
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data?.error?.message || (err as Error)?.message;
    return { ok: false, error: msg };
  }
}
