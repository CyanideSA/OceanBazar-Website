import type { BotContext, ChatIntent, ExtractedEntities } from './types';

interface IntentRule {
  intent: ChatIntent;
  keywords: string[];
  weight: number;
  patterns?: RegExp[];
}

const RULES: IntentRule[] = [
  {
    intent: 'human_handoff',
    keywords: [
      'human', 'agent', 'person', 'staff', 'representative', 'talk to', 'speak to',
      'live agent', 'escalate', 'customer care', 'help desk',
      'এজেন্ট', 'মানুষ', 'কাস্টমার কেয়ার', 'সাপোর্ট এজেন্ট',
    ],
    weight: 10,
  },
  {
    intent: 'wholesale_application',
    keywords: ['wholesale', 'bulk', 'b2b', 'business account', 'trade license', 'পাইকারি', 'হোলসেল'],
    weight: 9,
  },
  {
    intent: 'contact_support',
    keywords: [
      'contact', 'email support', 'call support', 'reach out', 'get in touch',
      'inquiry', 'enquire', 'enquiry', 'business inquiry', 'partnership', 'collaborate',
      'যোগাযোগ', 'অনুসন্ধান', 'ইনকোয়ারি',
    ],
    weight: 8,
  },
  {
    intent: 'ticket_creation',
    keywords: ['ticket', 'complaint', 'issue', 'problem', 'dispute', 'অভিযোগ', 'সমস্যা'],
    weight: 8,
  },
  {
    intent: 'order_tracking',
    keywords: [
      'track', 'tracking', 'where is', 'delivery status', 'shipment', 'shipped',
      'my order', 'order status', 'অর্ডার', 'ট্র্যাক', 'ডেলিভারি',
    ],
    weight: 9,
    patterns: [/OB-[A-F0-9]{8}/i, /\b[A-F0-9]{8}\b/],
  },
  {
    intent: 'cancel_order',
    keywords: ['cancel order', 'cancellation', 'cancel my order', 'stop order', 'অর্ডার ক্যানসেল'],
    weight: 9,
  },
  {
    intent: 'refund_request',
    keywords: ['refund', 'money back', 'refund status', 'রিফান্ড', 'টাকা ফেরত'],
    weight: 9,
  },
  {
    intent: 'return_request',
    keywords: ['return', 'exchange', 'wrong item', 'damaged', 'defective', 'রিটার্ন', 'এক্সচেঞ্জ'],
    weight: 9,
  },
  {
    intent: 'checkout_flow',
    keywords: ['checkout', 'place order', 'pay now', 'complete order', 'buy now', 'চেকআউট'],
    weight: 8,
  },
  {
    intent: 'cart_management',
    keywords: ['cart', 'my cart', 'add to cart', 'remove from cart', 'basket', 'কার্ট', 'ব্যাগ'],
    weight: 8,
  },
  {
    intent: 'product_recommendation',
    keywords: ['recommend', 'suggestion', 'best', 'popular', 'trending', 'top rated', 'বেস্ট', 'জনপ্রিয়'],
    weight: 7,
  },
  {
    intent: 'product_search',
    keywords: [
      'search', 'find', 'looking for', 'want', 'need', 'show me', 'browse',
      'খুঁজছি', 'চাই', 'দেখাও', 'সার্চ',
    ],
    weight: 7,
  },
  {
    intent: 'account_login',
    keywords: ['login', 'log in', 'sign in', 'লগইন', 'সাইন ইন'],
    weight: 8,
  },
  {
    intent: 'signup',
    keywords: ['signup', 'sign up', 'register', 'create account', 'রেজিস্টার'],
    weight: 8,
  },
  {
    intent: 'password_reset',
    keywords: ['forgot password', 'reset password', 'password reset', 'পাসওয়ার্ড'],
    weight: 8,
  },
  {
    intent: 'account_recovery',
    keywords: ['recover account', 'locked out', 'cant login', "can't login", 'lost access'],
    weight: 8,
  },
  {
    intent: 'faq_handling',
    keywords: [
      'faq', 'help', 'how do', 'what is', 'policy', 'shipping', 'payment', 'pay',
      'cod', 'bkash', 'nagad', 'coupon', 'sslcommerz', 'card',
      'পেমেন্ট', 'বিকাশ', 'নগদ', 'কুপন', 'শিপিং',
    ],
    weight: 5,
  },
];

/** Keep letters from any language (Bangla product names) + digits. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'a', 'an', 'the', 'is', 'are', 'for', 'to', 'of', 'and', 'or', 'please',
  'ami', 'amar', 'ekta', 'akta', 'one', 'some',
]);

function extractEntities(text: string): ExtractedEntities {
  const entities: ExtractedEntities = {};
  const orderMatch = text.match(/OB-([A-F0-9]{8})/i) || text.match(/\b([A-F0-9]{8})\b/i);
  if (orderMatch) {
    entities.orderNumber = orderMatch[0].toUpperCase().startsWith('OB-')
      ? orderMatch[0].toUpperCase()
      : `OB-${orderMatch[1].toUpperCase()}`;
  }
  const qtyMatch = text.match(/\b(\d{1,3})\s*(pcs|pieces|qty|units)?\b/i);
  if (qtyMatch) entities.quantity = parseInt(qtyMatch[1], 10);
  const budgetMatch =
    text.match(/(?:under|below|max|budget)\s*([৳$]?\s*\d+)/i) ||
    text.match(/([৳$]?\s*\d+)\s*(tk|bdt|taka)/i);
  if (budgetMatch) entities.budget = parseInt(budgetMatch[1].replace(/[^\d]/g, ''), 10);
  const sizeMatch = text.match(/\bsize\s*(\d{1,2}|xs|s|m|l|xl|xxl)\b/i);
  if (sizeMatch) entities.size = sizeMatch[1].toUpperCase();

  const cleaned = normalize(text)
    .replace(
      /\b(i want|i need|looking for|find me|show me|search for|browse|please|খুঁজছি|চাই|দেখাও|সার্চ)\b/gi,
      '',
    )
    .trim()
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(' ')
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

export function classifyIntent(
  text: string,
  ctx: BotContext,
): { intent: ChatIntent; confidence: number; entities: ExtractedEntities } {
  const n = normalize(text);
  const entities = extractEntities(text);

  if (ctx.flow && ctx.flow in FLOW_INTENT_MAP) {
    return { intent: FLOW_INTENT_MAP[ctx.flow], confidence: 1, entities };
  }

  const scores = new Map<ChatIntent, number>();
  for (const rule of RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (n.includes(kw.toLowerCase()) || text.toLowerCase().includes(kw.toLowerCase())) {
        score += rule.weight;
      }
    }
    for (const pat of rule.patterns || []) {
      if (pat.test(text)) score += rule.weight;
    }
    if (score > 0) scores.set(rule.intent, (scores.get(rule.intent) || 0) + score);
  }

  if (entities.orderNumber) scores.set('order_tracking', (scores.get('order_tracking') || 0) + 12);

  // Bare product name / short query → product search (even if weak FAQ noise)
  if (entities.productQuery && entities.productQuery.length >= 2) {
    const onlyWeakFaq = !scores.size || (scores.size === 1 && scores.has('faq_handling') && (scores.get('faq_handling') || 0) < 8);
    if (!scores.size || onlyWeakFaq) {
      scores.set('product_search', Math.max(scores.get('product_search') || 0, 8));
    } else if (!scores.has('product_search') && !scores.has('order_tracking') && !scores.has('cart_management') && !scores.has('human_handoff')) {
      scores.set('product_search', 5);
    }
  }

  // Payment-focused phrases
  if (/\b(payment|pay|bkash|nagad|cod|card|sslcommerz|পেমেন্ট|বিকাশ|নগদ)\b/i.test(text)) {
    scores.set('faq_handling', (scores.get('faq_handling') || 0) + 6);
  }

  if (['hi', 'hello', 'hey', 'salam', 'assalamu', 'হ্যালো', 'হাই'].some((g) => n === g || n.startsWith(`${g} `))) {
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
