export type ChatIntent =
  | 'product_search'
  | 'product_recommendation'
  | 'cart_management'
  | 'checkout_flow'
  | 'order_tracking'
  | 'cancel_order'
  | 'refund_request'
  | 'return_request'
  | 'account_login'
  | 'signup'
  | 'password_reset'
  | 'account_recovery'
  | 'ticket_creation'
  | 'wholesale_application'
  | 'contact_support'
  | 'human_handoff'
  | 'faq_handling';

export type MessageType = 'text' | 'product_card' | 'order_card' | 'system_action' | 'quick_replies';

export type FlowName =
  | 'product_discovery'
  | 'cart'
  | 'checkout'
  | 'order_tracking'
  | 'return_refund'
  | 'account'
  | 'wholesale'
  | 'contact'
  | null;

export interface ExtractedEntities {
  orderNumber?: string;
  orderId?: string;
  productQuery?: string;
  quantity?: number;
  budget?: number;
  size?: string;
  category?: string;
}

export interface BotContext {
  lastIntent?: ChatIntent;
  memory: Array<{ role: 'user' | 'bot'; text: string; at: string }>;
  flow: FlowName;
  step: number;
  slots: Record<string, string | number | boolean | null>;
}

export interface ProductCardContent {
  id: string;
  name: string;
  price: number;
  image?: string;
  rating?: number;
  stock?: number;
  url?: string;
}

export interface OrderCardContent {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  trackingNumber?: string;
  timeline: Array<{ label: string; done: boolean; at?: string }>;
}

export interface SystemActionContent {
  action: string;
  label: string;
  url?: string;
  payload?: Record<string, unknown>;
}

export interface StructuredMessage {
  id: string;
  sender: 'bot';
  message: string;
  message_type: MessageType;
  content?: ProductCardContent | OrderCardContent | SystemActionContent | ProductCardContent[] | Record<string, unknown>;
  timestamp: string;
  status: 'sent';
  quickReplies?: string[];
  typingMs?: number;
}

export interface ChatSessionLike {
  id: string;
  user_id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  status: string;
  bot_context?: BotContext | null;
  channel?: string;
}

export interface EngineInput {
  session: ChatSessionLike;
  text: string;
  userId: string;
  isAuthenticated: boolean;
  userName?: string;
}

export interface EngineActionInput {
  session: ChatSessionLike;
  action: string;
  payload?: Record<string, unknown>;
  userId: string;
  isAuthenticated: boolean;
  userName?: string;
}

export interface EngineResult {
  messages: StructuredMessage[];
  contextPatch: Partial<BotContext>;
  escalate: boolean;
  escalateReason?: string;
  clearFlow?: boolean;
}

export const DEFAULT_QUICK_REPLIES = [
  'Track Order',
  'Browse Products',
  'My Cart',
  'Return Item',
  'Talk to Human',
  'Payment Help',
];

export function emptyContext(): BotContext {
  return { memory: [], flow: null, step: 0, slots: {} };
}

export function msgId(prefix = 'bot') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function pushMemory(ctx: BotContext, role: 'user' | 'bot', text: string): BotContext {
  const memory = [...(ctx.memory || []), { role, text, at: new Date().toISOString() }].slice(-10);
  return { ...ctx, memory };
}
