import { prisma } from '../../lib/prisma';

import { v4 as uuidv4 } from 'uuid';
import { generateEntityId } from '../../utils/hexId';
import { processMessage } from '../chat/chatEngine';
import { getWelcomeMessages } from '../chat/chatEngine';
import { sendMessengerText } from './metaClient';
import { sendWhatsAppText } from './whatsappClient';

const prismaAny = prisma as any;

type ChatPlatform = 'facebook' | 'instagram' | 'whatsapp';

function platformFromObject(obj: string, messaging?: unknown): ChatPlatform {
  if (obj === 'instagram') return 'instagram';
  if (obj === 'whatsapp_business_account') return 'whatsapp';
  const ev = Array.isArray(messaging) ? messaging[0] : null;
  if (ev && typeof ev === 'object' && 'message' in ev) {
    const msg = (ev as { message?: { is_echo?: boolean } }).message;
    if (msg && !msg.is_echo) {
      /* instagram messaging uses same page object but different sender patterns */
    }
  }
  return 'facebook';
}

async function getOrCreateMetaSession(platform: ChatPlatform, platformUserId: string, senderName?: string) {
  const thread = await prismaAny.meta_threads.findUnique({
    where: { platform_platform_user_id: { platform, platform_user_id: platformUserId } },
    include: { chat_session: true },
  });
  if (thread?.chat_session?.is_active) return thread.chat_session;

  const userId = `meta-${platform}-${platformUserId}`;
  const welcome = getWelcomeMessages(senderName);
  const session = await prismaAny.chat_sessions.create({
    data: {
      id: generateEntityId(),
      user_id: userId,
      visitor_id: userId,
      customer_name: senderName || 'Meta User',
      status: 'bot',
      channel: platform,
      messages: welcome,
      bot_context: { memory: [], flow: null, step: 0, slots: {} },
      is_active: true,
    },
  });
  await prismaAny.meta_threads.create({
    data: {
      id: uuidv4(),
      platform,
      platform_user_id: platformUserId,
      chat_session_id: session.id,
    },
  });
  return session;
}

function structuredToPlainText(messages: Array<{ message: string; message_type?: string; content?: unknown }>): string {
  return messages
    .map((m) => {
      if (m.message_type === 'product_card' && Array.isArray(m.content)) {
        const cards = m.content as Array<{ name: string; price: number }>;
        return `${m.message}\n${cards.map((c) => `• ${c.name} — ৳${c.price}`).join('\n')}`;
      }
      if (m.message_type === 'order_card' && m.content && typeof m.content === 'object') {
        const o = m.content as { orderNumber: string; status: string };
        return `${m.message}\nOrder ${o.orderNumber}: ${o.status}`;
      }
      return m.message;
    })
    .join('\n\n');
}

async function processInboundText(
  platform: ChatPlatform,
  senderId: string,
  text: string,
  senderName?: string,
): Promise<void> {
  const session = await getOrCreateMetaSession(platform, senderId, senderName);
  const account = await prismaAny.meta_accounts.findFirst({ where: { status: 'connected' } });
  const pageToken = account?.page_access_token || process.env.META_PAGE_ACCESS_TOKEN;

  const userMsg = {
    id: `u-${Date.now()}`,
    sender: 'user',
    senderId,
    message: text,
    timestamp: new Date().toISOString(),
    status: 'sent',
  };
  const existing = Array.isArray(session.messages) ? session.messages : [];
  const merged = [...existing, userMsg];

  const result = await processMessage({
    session,
    text,
    userId: session.user_id,
    isAuthenticated: false,
    userName: session.customer_name,
  });

  const botMsgs = result.messages;
  const allMsgs = [...merged, ...botMsgs];
  await prismaAny.chat_sessions.update({
    where: { id: session.id },
    data: { messages: allMsgs, bot_context: result.contextPatch, last_message_at: new Date() },
  });

  const reply = structuredToPlainText(botMsgs);
  if (platform === 'whatsapp') {
    await sendWhatsAppText(senderId, reply);
  } else {
    await sendMessengerText(senderId, reply, pageToken);
  }
}

export async function handleMetaMessagingEvent(entry: any, objectType = 'page'): Promise<void> {
  const messagingEvents = entry?.messaging || [];
  for (const ev of messagingEvents) {
    const senderId = ev?.sender?.id;
    const text = ev?.message?.text;
    if (!senderId || !text || ev?.message?.is_echo) continue;

    const platform = platformFromObject(objectType, messagingEvents);
    await processInboundText(platform, senderId, text);
  }
}

export async function handleWhatsAppMessagingEvent(entry: any): Promise<void> {
  const changes = entry?.changes || [];
  for (const change of changes) {
    const value = change?.value;
    if (change?.field !== 'messages' || !value?.messages) continue;
    for (const msg of value.messages) {
      if (msg.type !== 'text' || !msg.text?.body) continue;
      const senderId = msg.from;
      const profileName = value.contacts?.[0]?.profile?.name;
      await processInboundText('whatsapp', senderId, msg.text.body, profileName);
    }
  }
}

export async function logWebhookEvent(eventType: string, payload: unknown): Promise<void> {
  await prismaAny.meta_webhook_events.create({
    data: { id: uuidv4(), event_type: eventType, payload: payload as object, processed: true },
  });
}
