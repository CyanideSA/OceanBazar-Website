import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { generateEntityId } from '../../utils/hexId';
import { emitToRoom } from '../../lib/adminEvents';
import type {
  BotContext,
  ChatIntent,
  EngineResult,
  ExtractedEntities,
  ProductCardContent,
} from './types';
import { DEFAULT_QUICK_REPLIES } from './types';
import { acknowledge, buildTextMessage, buildTypedMessage, fallback, greeting } from './responseVariator';

const prisma = new PrismaClient();

function toNum(v: unknown): number {
  return Number(v ?? 0);
}

async function searchProducts(query: string, budget?: number, limit = 5): Promise<ProductCardContent[]> {
  const terms = query.split(/\s+/).filter((t) => t.length > 2).slice(0, 5);
  const where: Record<string, unknown> = { status: 'active', stock: { gt: 0 } };
  if (terms.length) {
    where.OR = terms.flatMap((t) => [
      { titleEn: { contains: t, mode: 'insensitive' } },
      { titleBn: { contains: t, mode: 'insensitive' } },
      { brand: { contains: t, mode: 'insensitive' } },
    ]);
  }
  const products = await prisma.product.findMany({
    where,
    take: limit,
    orderBy: [{ isBestSeller: 'desc' }, { ratingAvg: 'desc' }],
    include: {
      pricing: { where: { customerType: 'retail' }, take: 1 },
      productAssets: { where: { isPrimary: true }, take: 1 },
    },
  });
  const cards: ProductCardContent[] = [];
  for (const p of products) {
    const price = toNum(p.pricing[0]?.price);
    if (budget && price > budget) continue;
    cards.push({
      id: p.id,
      name: p.titleEn,
      price,
      rating: p.ratingAvg ? toNum(p.ratingAvg) : undefined,
      stock: p.stock,
      image: p.productAssets[0]?.url,
      url: `/en/products/${p.id}`,
    });
  }
  return cards.slice(0, limit);
}

async function getCartSummary(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: { include: { productAssets: { where: { isPrimary: true }, take: 1 } } } } } },
  });
  if (!cart?.items.length) return null;
  const lines = cart.items.map((i) => ({
    productId: i.productId,
    title: i.product.titleEn,
    quantity: i.quantity,
    unitPrice: toNum(i.unitPrice),
    image: i.product.productAssets[0]?.url,
  }));
  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  return { lines, total, itemCount: cart.items.length };
}

async function addToCart(userId: string, productId: string, quantity = 1): Promise<{ ok: boolean; message: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { pricing: { where: { customerType: 'retail' }, take: 1 } },
  });
  if (!product || product.status !== 'active') return { ok: false, message: 'Product not found.' };
  if (product.stock < quantity) return { ok: false, message: 'Insufficient stock.' };
  const price = toNum(product.pricing[0]?.price);
  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) cart = await prisma.cart.create({ data: { userId } });
  const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId } });
  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + quantity } });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId, quantity, unitPrice: price, customerType: 'retail' },
    });
  }
  return { ok: true, message: `Added ${product.titleEn} to your cart.` };
}

function orderTimeline(status: string) {
  const steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  const idx = steps.indexOf(status);
  return steps.map((s, i) => ({
    label: s.charAt(0).toUpperCase() + s.slice(1),
    done: idx >= 0 ? i <= idx : s === 'pending',
  }));
}

async function trackOrder(userId: string, entities: ExtractedEntities, isAuth: boolean): Promise<EngineResult> {
  if (!isAuth) {
    return {
      messages: [buildTextMessage('Please log in to track your orders.', { quickReplies: ['Login help'] })],
      contextPatch: { flow: 'order_tracking', step: 0, slots: {} },
      escalate: false,
    };
  }
  const orderNumber = entities.orderNumber;
  const order = orderNumber
    ? await prisma.order.findFirst({ where: { userId, orderNumber: orderNumber.toUpperCase() } })
    : await prisma.order.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  if (!order) {
    return {
      messages: [buildTextMessage('I could not find that order. Share your order number (e.g. OB-A3F2B1C9).', { quickReplies: ['Talk to Human'] })],
      contextPatch: { flow: 'order_tracking', step: 1, slots: {} },
      escalate: false,
    };
  }
  return {
    messages: [
      buildTypedMessage(
        `Here is your order **${order.orderNumber}** — status: **${order.status}**.`,
        'order_card',
        {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: toNum(order.total),
          trackingNumber: order.trackingNumber || undefined,
          timeline: orderTimeline(order.status),
        },
        { quickReplies: ['Return Item', 'Talk to Human'] },
      ),
    ],
    contextPatch: { flow: null, step: 0, slots: { orderId: order.id } },
    escalate: false,
    clearFlow: true,
  };
}

async function handleReturnRefund(
  userId: string,
  isAuth: boolean,
  ctx: BotContext,
  text: string,
  intent: ChatIntent,
): Promise<EngineResult> {
  if (!isAuth) {
    return {
      messages: [buildTextMessage('Log in first so I can process your return or refund.', { quickReplies: ['Login help'] })],
      contextPatch: { flow: 'return_refund', step: 0, slots: {} },
      escalate: false,
    };
  }
  if (ctx.step === 0) {
    return {
      messages: [buildTextMessage('What is the reason for your return or refund?', { quickReplies: ['Damaged item', 'Wrong item', 'Changed mind'] })],
      contextPatch: { flow: 'return_refund', step: 1, slots: {} },
      escalate: false,
    };
  }
  const reason = text.trim();
  const orderId = (ctx.slots.orderId as string) || undefined;
  const order = orderId
    ? await prisma.order.findFirst({ where: { id: orderId, userId } })
    : await prisma.order.findFirst({ where: { userId, status: { in: ['delivered', 'shipped'] } }, orderBy: { createdAt: 'desc' } });
  if (!order) {
    return {
      messages: [buildTextMessage('No eligible order found for return. Orders must be delivered within 7 days.', { quickReplies: ['Talk to Human'] })],
      contextPatch: { flow: null, step: 0, slots: {} },
      escalate: false,
      clearFlow: true,
    };
  }
  const daysSince = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 30) {
    return {
      messages: [buildTextMessage('This order is outside the return window. I can connect you with support.', { quickReplies: ['Talk to Human'] })],
      contextPatch: {},
      escalate: true,
      escalateReason: 'Return window expired',
    };
  }
  const existing = await (prisma as any).return_requests.findFirst({ where: { order_id: order.id, user_id: userId } });
  if (!existing) {
    await (prisma as any).return_requests.create({
      data: {
        id: uuidv4(),
        order_id: order.id,
        user_id: userId,
        reason,
        reason_category: intent === 'refund_request' ? 'refund' : 'return',
        status: 'pending',
        timeline: JSON.stringify([{ status: 'pending', at: new Date().toISOString() }]),
      },
    });
  }
  const ticket = await prisma.ticket.create({
    data: {
      id: generateEntityId(),
      userId,
      orderId: order.id,
      subject: `${intent === 'refund_request' ? 'Refund' : 'Return'} request — ${order.orderNumber}`,
      category: 'other',
      priority: 'medium',
      messages: { create: { senderType: 'customer', senderId: userId, message: reason, attachments: [] } },
    },
  });
  emitToRoom('admin:chat', 'ticket:new', { ticket });
  return {
    messages: [
      buildTypedMessage(
        `Your ${intent === 'refund_request' ? 'refund' : 'return'} request for **${order.orderNumber}** has been submitted. Ticket **${ticket.id}** created.`,
        'system_action',
        { action: 'view_ticket', label: 'View ticket', payload: { ticketId: ticket.id } },
        { quickReplies: ['Track Order', 'Talk to Human'] },
      ),
    ],
    contextPatch: { flow: null, step: 0, slots: {} },
    escalate: false,
    clearFlow: true,
  };
}

export async function runIntentHandler(opts: {
  intent: ChatIntent;
  text: string;
  entities: ExtractedEntities;
  ctx: BotContext;
  userId: string;
  isAuthenticated: boolean;
  userName?: string;
}): Promise<EngineResult> {
  const { intent, text, entities, ctx, userId, isAuthenticated, userName } = opts;

  if (intent === 'human_handoff') {
    return {
      messages: [buildTextMessage('Connecting you with a human agent now. Please hold on.', { quickReplies: [] })],
      contextPatch: {},
      escalate: true,
      escalateReason: 'Customer requested human agent',
    };
  }

  if (intent === 'product_search' || intent === 'product_recommendation') {
    if (ctx.flow === 'product_discovery' && ctx.step < 2 && !entities.productQuery) {
      const prompts = [
        'What type of product are you looking for?',
        'Any budget preference? (e.g. under 2000)',
        'Preferred size or brand?',
      ];
      return {
        messages: [buildTextMessage(prompts[ctx.step] || prompts[0], { quickReplies: ['Under 1500', 'Electronics', 'Fashion'] })],
        contextPatch: { flow: 'product_discovery', step: ctx.step + 1, slots: { ...ctx.slots, ...(entities.budget ? { budget: entities.budget } : {}) } },
        escalate: false,
      };
    }
    const query = entities.productQuery || (ctx.slots.productQuery as string) || text;
    const budget = entities.budget || (ctx.slots.budget as number | undefined);
    const cards = intent === 'product_recommendation'
      ? await searchProducts('popular', budget, 4)
      : await searchProducts(query, budget, 5);
    if (!cards.length) {
      return {
        messages: [buildTextMessage('No products matched. Try different keywords or browse categories.', { quickReplies: DEFAULT_QUICK_REPLIES })],
        contextPatch: { flow: null, step: 0, slots: {} },
        escalate: false,
        clearFlow: true,
      };
    }
    return {
      messages: [
        buildTypedMessage(
          acknowledge(userName) + ` Found ${cards.length} product(s) for you:`,
          'product_card',
          cards,
          { quickReplies: ['Add to cart', 'View details', 'Compare'] },
        ),
      ],
      contextPatch: { flow: null, step: 0, slots: { productQuery: query, budget: budget ?? null } },
      escalate: false,
      clearFlow: true,
    };
  }

  if (intent === 'cart_management') {
    if (!isAuthenticated) {
      return {
        messages: [buildTextMessage('Log in to view and manage your cart.', { quickReplies: ['Login help', 'Signup'] })],
        contextPatch: { flow: 'cart', step: 0, slots: {} },
        escalate: false,
      };
    }
    const summary = await getCartSummary(userId);
    if (!summary) {
      return {
        messages: [buildTextMessage('Your cart is empty. Want me to find products?', { quickReplies: ['Browse Products'] })],
        contextPatch: { flow: null, step: 0, slots: {} },
        escalate: false,
      };
    }
    return {
      messages: [
        buildTypedMessage(
          `Your cart has **${summary.itemCount}** item(s) — total **৳${summary.total.toFixed(0)}**.`,
          'system_action',
          { action: 'view_cart', label: 'View cart', url: '/en/cart', payload: { lines: summary.lines, total: summary.total } },
          { quickReplies: ['Proceed to checkout', 'Browse Products'] },
        ),
      ],
      contextPatch: { flow: 'cart', step: 0, slots: {} },
      escalate: false,
    };
  }

  if (intent === 'checkout_flow') {
    if (!isAuthenticated) {
      return { messages: [buildTextMessage('Please log in to checkout.', { quickReplies: ['Login help'] })], contextPatch: { flow: 'checkout', step: 0, slots: {} }, escalate: false };
    }
    const steps = ['Confirm shipping address', 'Choose shipping method', 'Select payment (bKash, Nagad, COD, Card)', 'Review and place order'];
    const step = Math.min(ctx.step, steps.length - 1);
    if (step >= steps.length - 1) {
      return {
        messages: [
          buildTypedMessage('Ready to place your order?', 'system_action', { action: 'checkout', label: 'Go to checkout', url: '/en/checkout' }),
        ],
        contextPatch: { flow: null, step: 0, slots: {} },
        escalate: false,
        clearFlow: true,
      };
    }
    return {
      messages: [buildTextMessage(`Checkout step ${step + 1}: ${steps[step]}`, { quickReplies: ['Continue', 'Talk to Human'] })],
      contextPatch: { flow: 'checkout', step: step + 1, slots: ctx.slots },
      escalate: false,
    };
  }

  if (intent === 'order_tracking') return trackOrder(userId, entities, isAuthenticated);
  if (intent === 'return_request' || intent === 'refund_request') return handleReturnRefund(userId, isAuthenticated, ctx, text, intent);

  if (intent === 'cancel_order') {
    if (!isAuthenticated) return { messages: [buildTextMessage('Log in to cancel an order.')], contextPatch: {}, escalate: false };
    const order = await prisma.order.findFirst({ where: { userId, status: { in: ['pending', 'confirmed', 'processing'] } }, orderBy: { createdAt: 'desc' } });
    if (!order) return { messages: [buildTextMessage('No cancellable orders found. Shipped orders must use returns.')], contextPatch: {}, escalate: false };
    return {
      messages: [buildTypedMessage(`Cancel order **${order.orderNumber}**?`, 'system_action', { action: 'cancel_order', label: 'Cancel order', payload: { orderId: order.id } })],
      contextPatch: { slots: { orderId: order.id } },
      escalate: false,
    };
  }

  if (['account_login', 'signup', 'password_reset', 'account_recovery'].includes(intent)) {
    const urls: Record<string, string> = {
      account_login: '/en/auth/login',
      signup: '/en/auth/register',
      password_reset: '/en/auth/forgot-password',
      account_recovery: '/en/tickets',
    };
    const labels: Record<string, string> = {
      account_login: 'Go to login',
      signup: 'Create account',
      password_reset: 'Reset password',
      account_recovery: 'Open support ticket',
    };
    return {
      messages: [
        buildTypedMessage('I can guide you through account access.', 'system_action', { action: intent, label: labels[intent], url: urls[intent] }),
      ],
      contextPatch: { flow: 'account', step: 0, slots: {} },
      escalate: intent === 'account_recovery',
      escalateReason: intent === 'account_recovery' ? 'Account recovery requested' : undefined,
    };
  }

  if (intent === 'wholesale_application') {
    if (!isAuthenticated) {
      return { messages: [buildTextMessage('Log in to apply for wholesale access.')], contextPatch: { flow: 'wholesale', step: 0, slots: {} }, escalate: false };
    }
    if (ctx.step === 0) {
      return { messages: [buildTextMessage('What is your business name?')], contextPatch: { flow: 'wholesale', step: 1, slots: {} }, escalate: false };
    }
    if (ctx.step === 1) {
      return { messages: [buildTextMessage('Please share your trade license number.')], contextPatch: { flow: 'wholesale', step: 2, slots: { businessName: text } }, escalate: false };
    }
    if (ctx.step === 2) {
      return { messages: [buildTextMessage('Business address?')], contextPatch: { flow: 'wholesale', step: 3, slots: { ...ctx.slots, tradeLicense: text } }, escalate: false };
    }
    const prismaAny = prisma as any;
    const existing = await prismaAny.wholesale_applications.findFirst({ where: { user_id: userId, status: { in: ['pending', 'approved'] } } });
    if (existing) {
      return { messages: [buildTextMessage('You already have a wholesale application on file.')], contextPatch: { flow: null, step: 0, slots: {} }, escalate: false, clearFlow: true };
    }
    await prismaAny.wholesale_applications.create({
      data: {
        id: generateEntityId(),
        user_id: userId,
        business_name: String(ctx.slots.businessName),
        tax_id: String(ctx.slots.tradeLicense),
        business_description: text,
        status: 'pending',
      },
    });
    return {
      messages: [buildTextMessage('Wholesale application submitted! Our team will review it within 2 business days.')],
      contextPatch: { flow: null, step: 0, slots: {} },
      escalate: false,
      clearFlow: true,
    };
  }

  if (intent === 'contact_support' || intent === 'ticket_creation') {
    if (!isAuthenticated) {
      return { messages: [buildTextMessage('Log in to create a support ticket, or say "human" for live chat.')], contextPatch: { flow: 'contact', step: 0, slots: {} }, escalate: false };
    }
    if (ctx.step === 0) {
      return { messages: [buildTextMessage('Briefly describe your issue:')], contextPatch: { flow: 'contact', step: 1, slots: {} }, escalate: false };
    }
    const ticket = await prisma.ticket.create({
      data: {
        id: generateEntityId(),
        userId,
        subject: text.slice(0, 200) || 'Support request from chat',
        category: 'other',
        priority: 'medium',
        messages: { create: { senderType: 'customer', senderId: userId, message: text, attachments: [] } },
      },
    });
    emitToRoom('admin:chat', 'ticket:new', { ticket });
    return {
      messages: [buildTypedMessage(`Ticket **${ticket.id}** created. Our team will respond soon.`, 'system_action', { action: 'view_ticket', label: 'View ticket', payload: { ticketId: ticket.id } })],
      contextPatch: { flow: null, step: 0, slots: {} },
      escalate: false,
      clearFlow: true,
    };
  }

  if (intent === 'faq_handling') {
    const faqReplies: Record<string, string> = {
      shipping: 'Standard delivery: Dhaka 1-3 days, outside Dhaka 3-5 days. Free shipping over ৳1,500.',
      payment: 'We accept bKash, Nagad, cards via SSLCommerz, and Cash on Delivery.',
      cod: 'COD is available for orders under ৳5,000.',
      coupon: 'Apply coupon codes at checkout in the promo box.',
    };
    const n = text.toLowerCase();
    let answer = '';
    for (const [k, v] of Object.entries(faqReplies)) {
      if (n.includes(k)) { answer = v; break; }
    }
    return {
      messages: [buildTextMessage(answer || greeting(userName), { quickReplies: DEFAULT_QUICK_REPLIES })],
      contextPatch: {},
      escalate: false,
    };
  }

  return {
    messages: [buildTextMessage(fallback(userName), { quickReplies: DEFAULT_QUICK_REPLIES })],
    contextPatch: {},
    escalate: false,
  };
}

export async function runActionHandler(opts: {
  action: string;
  payload?: Record<string, unknown>;
  userId: string;
  isAuthenticated: boolean;
  userName?: string;
}): Promise<EngineResult> {
  const { action, payload, userId, isAuthenticated, userName } = opts;

  if (action === 'talk_to_human' || action === 'human') {
    return {
      messages: [buildTextMessage('Connecting you with a human agent...')],
      contextPatch: {},
      escalate: true,
      escalateReason: 'Quick action: human handoff',
    };
  }

  if (action === 'add_to_cart' && payload?.productId) {
    if (!isAuthenticated) {
      return { messages: [buildTextMessage('Log in to add items to your cart.')], contextPatch: {}, escalate: false };
    }
    const qty = Number(payload.quantity || 1);
    const result = await addToCart(userId, String(payload.productId), qty);
    return { messages: [buildTextMessage(result.message, { quickReplies: ['My Cart', 'Checkout'] })], contextPatch: {}, escalate: false };
  }

  if (action === 'track_order') {
    return trackOrder(userId, { orderNumber: payload?.orderNumber as string | undefined }, isAuthenticated);
  }

  if (action === 'browse_products') {
    const cards = await searchProducts('popular', undefined, 4);
    return {
      messages: [buildTypedMessage('Popular picks for you:', 'product_card', cards, { quickReplies: ['Add to cart'] })],
      contextPatch: {},
      escalate: false,
    };
  }

  if (action === 'view_cart' || action === 'my_cart') {
    return runIntentHandler({ intent: 'cart_management', text: 'cart', entities: {}, ctx: { memory: [], flow: null, step: 0, slots: {} }, userId, isAuthenticated, userName });
  }

  if (action === 'start_return' || action === 'return_item') {
    return runIntentHandler({
      intent: 'return_request',
      text: 'return',
      entities: {},
      ctx: { memory: [], flow: 'return_refund', step: 0, slots: (payload || {}) as Record<string, string | number | boolean | null> },
      userId,
      isAuthenticated,
      userName,
    });
  }

  if (action === 'payment_help') {
    return runIntentHandler({ intent: 'faq_handling', text: 'payment methods', entities: {}, ctx: { memory: [], flow: null, step: 0, slots: {} }, userId, isAuthenticated, userName });
  }

  return {
    messages: [buildTextMessage('Action received. How else can I help?', { quickReplies: DEFAULT_QUICK_REPLIES })],
    contextPatch: {},
    escalate: false,
  };
}
