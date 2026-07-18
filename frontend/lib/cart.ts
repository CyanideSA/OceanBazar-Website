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

  return {
    id: toNum(item.id) || index + 1,
    productId,
    variantId: (item.variantId as string | null) ?? null,
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

  const subtotal = toNum(data.subtotal) || items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shippingFee = toNum(data.shippingFee ?? data.shipping);
  const gst = toNum(data.gst);
  const serviceFee = toNum(data.serviceFee);
  const discount = toNum(data.discount);
  const obDiscount = toNum(data.obDiscount);
  const total =
    toNum(data.total) || Math.max(0, subtotal + gst + shippingFee + serviceFee - discount - obDiscount);
  const itemCount = toNum(data.itemCount) || items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    cartId: toNum(data.cartId),
    items,
    retailQuantityOrder: data.retailQuantityOrder !== false,
    subtotal,
    discount,
    gst,
    shippingFee,
    serviceFee,
    obDiscount,
    total,
    codAllowed: data.codAllowed !== false,
    installmentAllowed: Boolean(data.installmentAllowed),
    itemCount,
  };
}
