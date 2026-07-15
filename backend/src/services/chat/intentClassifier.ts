import type { BotContext, ChatIntent, ExtractedEntities } from './types';

interface IntentRule {
  intent: ChatIntent;
  keywords: string[];
  weight: number;
  patterns?: RegExp[];
}

const RULES: IntentRule[] = [
  { intent: 'human_handoff', keywords: ['human', 'agent', 'person', 'staff', 'representative', 'talk to', 'speak to', 'live agent', 'escalate'], weight: 10 },
  { intent: 'wholesale_application', keywords: ['wholesale', 'bulk', 'b2b', 'business account', 'trade license'], weight: 9 },
  { intent: 'contact_support', keywords: ['contact', 'email support', 'call support', 'reach out', 'get in touch'], weight: 8 },
  { intent: 'ticket_creation', keywords: ['ticket', 'complaint', 'issue', 'problem', 'dispute'], weight: 8 },
  { intent: 'order_tracking', keywords: ['track', 'tracking', 'where is', 'delivery status', 'shipment', 'shipped'], weight: 9, patterns: [/OB-[A-F0-9]{8}/i, /\b[A-F0-9]{8}\b/] },
  { intent: 'cancel_order', keywords: ['cancel order', 'cancellation', 'cancel my order', 'stop order'], weight: 9 },
  { intent: 'refund_request', keywords: ['refund', 'money back', 'refund status'], weight: 9 },
  { intent: 'return_request', keywords: ['return', 'exchange', 'wrong item', 'damaged', 'defective'], weight: 9 },
  { intent: 'checkout_flow', keywords: ['checkout', 'place order', 'pay now', 'complete order', 'buy now'], weight: 8 },
  { intent: 'cart_management', keywords: ['cart', 'my cart', 'add to cart', 'remove from cart', 'basket'], weight: 8 },
  { intent: 'product_recommendation', keywords: ['recommend', 'suggestion', 'best', 'popular', 'trending', 'top rated'], weight: 7 },
  { intent: 'product_search', keywords: ['search', 'find', 'looking for', 'want', 'need', 'show me', 'browse'], weight: 7 },
  { intent: 'account_login', keywords: ['login', 'log in', 'sign in'], weight: 8 },
  { intent: 'signup', keywords: ['signup', 'sign up', 'register', 'create account'], weight: 8 },
  { intent: 'password_reset', keywords: ['forgot password', 'reset password', 'password reset'], weight: 8 },
  { intent: 'account_recovery', keywords: ['recover account', 'locked out', 'cant login', "can't login", 'lost access'], weight: 8 },
  { intent: 'faq_handling', keywords: ['faq', 'help', 'how do', 'what is', 'policy', 'shipping', 'payment', 'cod', 'bkash', 'nagad', 'coupon'], weight: 5 },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractEntities(text: string): ExtractedEntities {
  const entities: ExtractedEntities = {};
  const orderMatch = text.match(/OB-([A-F0-9]{8})/i) || text.match(/\b([A-F0-9]{8})\b/i);
  if (orderMatch) {
    entities.orderNumber = orderMatch[0].toUpperCase().startsWith('OB-') ? orderMatch[0].toUpperCase() : `OB-${orderMatch[1].toUpperCase()}`;
  }
  const qtyMatch = text.match(/\b(\d{1,3})\s*(pcs|pieces|qty|units)?\b/i);
  if (qtyMatch) entities.quantity = parseInt(qtyMatch[1], 10);
  const budgetMatch = text.match(/(?:under|below|max|budget)\s*([৳$]?\s*\d+)/i) || text.match(/([৳$]?\s*\d+)\s*(tk|bdt|taka)/i);
  if (budgetMatch) entities.budget = parseInt(budgetMatch[1].replace(/[^\d]/g, ''), 10);
  const sizeMatch = text.match(/\bsize\s*(\d{1,2}|xs|s|m|l|xl|xxl)\b/i);
  if (sizeMatch) entities.size = sizeMatch[1].toUpperCase();

  const cleaned = normalize(text)
    .replace(/\b(i want|i need|looking for|find me|show me|search for|browse)\b/g, '')
    .trim();
  if (cleaned.length >= 2) entities.productQuery = cleaned;

  return entities;
}

const FLOW_INTENT_MAP: Record<string, ChatIntent> = {
  product_discovery: 'product_search',
  cart: 'cart_management',
  checkout: 'checkout_flow',
  order_tracking: 'order_tracking',
  return_refund: 'return_request',
  account: 'account_login',
  wholesale: 'wholesale_application',
  contact: 'contact_support',
};

export function classifyIntent(text: string, ctx: BotContext): { intent: ChatIntent; confidence: number; entities: ExtractedEntities } {
  const n = normalize(text);
  const entities = extractEntities(text);

  if (ctx.flow && ctx.flow in FLOW_INTENT_MAP) {
    return { intent: FLOW_INTENT_MAP[ctx.flow], confidence: 1, entities };
  }

  const scores = new Map<ChatIntent, number>();
  for (const rule of RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (n.includes(kw)) score += rule.weight;
    }
    for (const pat of rule.patterns || []) {
      if (pat.test(text)) score += rule.weight;
    }
    if (score > 0) scores.set(rule.intent, (scores.get(rule.intent) || 0) + score);
  }

  if (entities.orderNumber) scores.set('order_tracking', (scores.get('order_tracking') || 0) + 12);
  if (entities.productQuery && entities.productQuery.length > 3 && !scores.size) {
    scores.set('product_search', 6);
  }

  if (['hi', 'hello', 'hey', 'salam', 'assalamu'].some((g) => n.startsWith(g) || n === g)) {
    scores.set('faq_handling', (scores.get('faq_handling') || 0) + 4);
  }

  let best: ChatIntent = 'faq_handling';
  let bestScore = 0;
  for (const [intent, score] of scores) {
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }

  const confidence = bestScore > 0 ? Math.min(1, bestScore / 15) : 0.3;
  return { intent: best, confidence, entities };
}
