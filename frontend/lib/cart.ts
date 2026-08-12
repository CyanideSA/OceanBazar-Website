import type { CartItem, CartSummary } from '@/types';

/** Safe BDT display — never throws on null/undefined API fields. */
export function formatCartMoney(value: unknown): string {
  if (typeof value === 'number' && !Number.isNaN(value)) return value.toLocaleString();
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (!Number.isNaN(n)) return n.toLocaleString();
  }
  return '0';
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function toRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function normalizeCartItem(row: unknown, index: number): CartItem | null {
  if (row == null) return null;
  const item = toRecord(row);
  const product = toRecord(item.product);

  const productId = String(item.productId ?? product.id ?? item.id ?? '').trim();
  if (!productId) return null;

  const quantity = Math.max(0, toNum(item.quantity));
  const unitPrice =
    item.unitPrice != null
      ? toNum(item.unitPrice)
      : toNum(item.price ?? product.price ?? product.retailPrice);
  const lineTotal = toNum(item.lineTotal) || unitPrice * quantity;

  const stock = product.stock != null ? toNum(product.stock) : null;
  const retailMaxQty = product.retailMaxQty != null ? toNum(product.retailMaxQty) : null;

  const variantId = (item.variantId as string | null) ?? null;
  const variantLabelRaw = item.variantLabel ?? item.variantName ?? product.variantLabel ?? null;
  const variantLabel =
    typeof variantLabelRaw === 'string' && variantLabelRaw.trim()
      ? variantLabelRaw.trim()
      : null;
  // #region agent log
  if (typeof fetch !== 'undefined' && (variantId || variantLabel || item.attributes || item.variantAttributes)) {
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'post-fix',hypothesisId:'H5',location:'cart.ts:normalizeCartItem',message:'cart item variant fields',data:{productId,variantId,hasVariantLabel:!!variantLabel,rawKeys:Object.keys(item).slice(0,20)},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
  return {
    id: toNum(item.id) || index + 1,
    productId,
    variantId,
    variantLabel,
    title: String(item.title ?? product.name ?? product.titleEn ?? product.title ?? 'Product'),
    image: (item.image as string | null) ?? (product.image as string | null) ?? null,
    quantity,
    unitPrice,
    lineTotal,
    discountPct: toNum(item.discountPct),
    tierApplied: toNum(item.tierApplied),
    stock,
    moq: Math.max(1, toNum(product.moq) || 1),
    retailMaxQty,
  };
}

function unwrapCartPayload(raw: unknown): Record<string, unknown> {
  const data = toRecord(raw);
  if (Array.isArray(data.items)) return data;
  if (data.cart) return toRecord(data.cart);
  const state = toRecord(data.state);
  if (state.cart) return toRecord(state.cart);
  if (Array.isArray(state.items)) return state;
  return data;
}

/** Maps Java core + legacy BFF cart payloads into storefront CartSummary. */
export function normalizeCartSummary(raw: unknown): CartSummary {
  const data = unwrapCartPayload(raw);
  const items = (Array.isArray(data.items) ? data.items : [])
    .map(normalizeCartItem)
    .filter((item): item is CartItem => item != null && item.quantity > 0);

  return buildCartSummaryFromItems(items, data);
}

export function buildCartSummaryFromItems(
  items: CartItem[],
  extras?: Record<string, unknown>,
): CartSummary {
  const cleaned = items
    .filter((item) => item.quantity > 0)
    .map((item, index) => ({
      ...item,
      id: item.id || index + 1,
      lineTotal: item.unitPrice * item.quantity,
    }));

  const subtotal = cleaned.reduce((sum, item) => sum + item.lineTotal, 0);
  const shippingFee = toNum(extras?.shippingFee ?? extras?.shipping);
  const gst = toNum(extras?.gst);
  const serviceFee = toNum(extras?.serviceFee);
  const discount = toNum(extras?.discount);
  const obDiscount = toNum(extras?.obDiscount);
  const total =
    toNum(extras?.total) || Math.max(0, subtotal + gst + shippingFee + serviceFee - discount - obDiscount);
  const itemCount = cleaned.reduce((sum, item) => sum + item.quantity, 0);

  return {
    cartId: toNum(extras?.cartId) || 0,
    items: cleaned,
    retailQuantityOrder: extras?.retailQuantityOrder !== false,
    subtotal,
    discount,
    gst,
    shippingFee,
    serviceFee,
    obDiscount,
    total,
    codAllowed: extras?.codAllowed !== false,
    installmentAllowed: Boolean(extras?.installmentAllowed),
    itemCount,
  };
}

export type GuestCartAddInput = {
  productId: string;
  title: string;
  image?: string | null;
  unitPrice: number;
  quantity: number;
  variantId?: string | null;
  variantLabel?: string | null;
  stock?: number | null;
  moq?: number;
  retailMaxQty?: number | null;
  discountPct?: number;
};

function sameLine(a: CartItem, productId: string, variantId?: string | null) {
  const v = variantId ?? null;
  return a.productId === productId && (a.variantId ?? null) === v;
}

/** Local guest cart: add or bump quantity without hitting the API. */
export function guestAddToCart(cart: CartSummary | null, input: GuestCartAddInput): CartSummary {
  const qty = Math.max(1, Math.floor(input.quantity) || 1);
  const items = [...(cart?.items ?? [])];
  const idx = items.findIndex((i) => sameLine(i, input.productId, input.variantId));
  if (idx >= 0) {
    const nextQty = items[idx].quantity + qty;
    items[idx] = {
      ...items[idx],
      quantity: nextQty,
      lineTotal: items[idx].unitPrice * nextQty,
      unitPrice: input.unitPrice || items[idx].unitPrice,
      title: input.title || items[idx].title,
      image: input.image ?? items[idx].image,
      stock: input.stock ?? items[idx].stock,
      retailMaxQty: input.retailMaxQty ?? items[idx].retailMaxQty,
      variantLabel: input.variantLabel ?? items[idx].variantLabel,
    };
  } else {
    items.push({
      id: Date.now() + items.length,
      productId: input.productId,
      variantId: input.variantId ?? null,
      variantLabel: input.variantLabel ?? null,
      title: input.title,
      image: input.image ?? null,
      quantity: qty,
      unitPrice: input.unitPrice,
      lineTotal: input.unitPrice * qty,
      discountPct: input.discountPct ?? 0,
      tierApplied: 0,
      stock: input.stock ?? null,
      moq: Math.max(1, input.moq || 1),
      retailMaxQty: input.retailMaxQty ?? null,
    });
  }
  return buildCartSummaryFromItems(items);
}

export function guestUpdateCartQty(
  cart: CartSummary | null,
  productId: string,
  quantity: number,
  variantId?: string | null,
): CartSummary {
  const items = (cart?.items ?? [])
    .map((item) => {
      if (!sameLine(item, productId, variantId)) return item;
      return { ...item, quantity, lineTotal: item.unitPrice * quantity };
    })
    .filter((item) => item.quantity > 0);
  return buildCartSummaryFromItems(items);
}

export function guestRemoveFromCart(
  cart: CartSummary | null,
  productId: string,
  variantId?: string | null,
): CartSummary {
  const items = (cart?.items ?? []).filter((item) => !sameLine(item, productId, variantId));
  return buildCartSummaryFromItems(items);
}
