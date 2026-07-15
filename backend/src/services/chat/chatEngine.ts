import type { BotContext, EngineActionInput, EngineInput, EngineResult, StructuredMessage } from './types';
import { emptyContext, pushMemory } from './types';
import { classifyIntent } from './intentClassifier';
import { runActionHandler, runIntentHandler } from './handlers';

export function parseBotContext(raw: unknown): BotContext {
  if (!raw || typeof raw !== 'object') return emptyContext();
  const c = raw as BotContext;
  return {
    lastIntent: c.lastIntent,
    memory: Array.isArray(c.memory) ? c.memory.slice(-10) : [],
    flow: c.flow ?? null,
    step: typeof c.step === 'number' ? c.step : 0,
    slots: c.slots && typeof c.slots === 'object' ? c.slots : {},
  };
}

export function mergeContext(ctx: BotContext, patch: Partial<BotContext>, clearFlow?: boolean): BotContext {
  const next: BotContext = {
    ...ctx,
    ...patch,
    memory: patch.memory ?? ctx.memory,
    slots: patch.slots ?? ctx.slots,
    flow: clearFlow ? null : (patch.flow !== undefined ? patch.flow : ctx.flow),
    step: clearFlow ? 0 : (patch.step !== undefined ? patch.step : ctx.step),
  };
  if (clearFlow) {
    next.flow = null;
    next.step = 0;
    next.slots = patch.slots ?? {};
  }
  return next;
}

export async function processMessage(input: EngineInput): Promise<EngineResult> {
  const ctx = parseBotContext(input.session.bot_context);
  const withUser = pushMemory(ctx, 'user', input.text.trim());
  const { intent, entities } = classifyIntent(input.text, withUser);
  withUser.lastIntent = intent;

  const result = await runIntentHandler({
    intent,
    text: input.text.trim(),
    entities,
    ctx: withUser,
    userId: input.userId,
    isAuthenticated: input.isAuthenticated,
    userName: input.userName || input.session.customer_name || undefined,
  });

  const botTexts = result.messages.map((m) => m.message).join(' ');
  let nextCtx = mergeContext(withUser, result.contextPatch, result.clearFlow);
  nextCtx = pushMemory(nextCtx, 'bot', botTexts);

  return { ...result, contextPatch: nextCtx };
}

export async function processAction(input: EngineActionInput): Promise<EngineResult> {
  const ctx = parseBotContext(input.session.bot_context);
  const result = await runActionHandler({
    action: input.action,
    payload: input.payload,
    userId: input.userId,
    isAuthenticated: input.isAuthenticated,
    userName: input.userName || input.session.customer_name || undefined,
  });

  const botTexts = result.messages.map((m) => m.message).join(' ');
  let nextCtx = mergeContext(ctx, result.contextPatch, result.clearFlow);
  nextCtx = pushMemory(nextCtx, 'bot', botTexts);

  return { ...result, contextPatch: nextCtx };
}

export function getWelcomeMessages(customerName?: string): StructuredMessage[] {
  const name = customerName ? `, ${customerName.split(' ')[0]}` : '';
  return [
    {
      id: `bot-welcome-${Date.now()}`,
      sender: 'bot',
      message: `Hi${name}! Welcome to **SUPPORT CHAT** — Powered by OceanBazar System.\n\nI can help with products, orders, cart, returns, and more — 24/7.`,
      message_type: 'text',
      timestamp: new Date().toISOString(),
      status: 'sent',
      typingMs: 500,
    },
    {
      id: `bot-welcome-qr-${Date.now()}`,
      sender: 'bot',
      message: 'How can I help you today?',
      message_type: 'quick_replies',
      timestamp: new Date().toISOString(),
      status: 'sent',
      quickReplies: ['Track Order', 'Browse Products', 'My Cart', 'Return Item', 'Talk to Human', 'Payment Help'],
    },
  ];
}
