/**
 * Oceanbazar Frontend Pricing Engine
 * Mirrors backend utils/pricing.ts — backend is authoritative.
 */

import type { ProductPricing } from '@/types';

export interface PricingResult {
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
  tierApplied: 0 | 1 | 2 | 3;
}

export function calculateRetailPrice(pricing: ProductPricing, qty: number): PricingResult {
  const base = pricing.price;
  let discountPct = 0;
  let tierApplied: 0 | 1 | 2 | 3 = 0;

  if (qty > 1) {
    const t1 = pricing.tier1MinQty ?? Infinity;
    const t2 = pricing.tier2MinQty ?? Infinity;
    const t3 = pricing.tier3MinQty ?? Infinity;

    if (qty >= t3 && pricing.tier3Discount != null) { discountPct = pricing.tier3Discount; tierApplied = 3; }
    else if (qty >= t2 && pricing.tier2Discount != null) { discountPct = pricing.tier2Discount; tierApplied = 2; }
    else if (qty >= t1 && pricing.tier1Discount != null) { discountPct = pricing.tier1Discount; tierApplied = 1; }
  }

  const unitPrice = round2(base * (1 - discountPct / 100));
  return { unitPrice, discountPct, lineTotal: round2(unitPrice * qty), tierApplied };
}

export function calculateWholesalePrice(
  retail: ProductPricing,
  wholesale: ProductPricing,
  qty: number,
  moq: number
): PricingResult {
  if (qty < moq) return calculateRetailPrice(retail, qty);

  const base = wholesale.price;
  let discountPct = 0;
  let tierApplied: 0 | 1 | 2 | 3 = 0;

  const t1 = wholesale.tier1MinQty ?? Infinity;
  const t2 = wholesale.tier2MinQty ?? Infinity;
  const t3 = wholesale.tier3MinQty ?? Infinity;

  if (qty >= t3 && wholesale.tier3Discount != null) { discountPct = wholesale.tier3Discount; tierApplied = 3; }
  else if (qty >= t2 && wholesale.tier2Discount != null) { discountPct = wholesale.tier2Discount; tierApplied = 2; }
  else if (qty >= t1 && wholesale.tier1Discount != null) { discountPct = wholesale.tier1Discount; tierApplied = 1; }

  const unitPrice = round2(base * (1 - discountPct / 100));
  return { unitPrice, discountPct, lineTotal: round2(unitPrice * qty), tierApplied };
}

function withVariantBase(p: ProductPricing, override: number | null | undefined): ProductPricing {
  if (override == null) return p;
  return { ...p, price: override };
}

export function calculatePrice(
  userType: 'retail' | 'wholesale',
  pricing: { retail: ProductPricing | null; wholesale: ProductPricing | null },
  qty: number,
  moq: number,
  variantPriceOverride?: number | null
): PricingResult {
  if (!pricing.retail) return { unitPrice: 0, discountPct: 0, lineTotal: 0, tierApplied: 0 };
  const retail = withVariantBase(pricing.retail, variantPriceOverride);
  const wholesale = pricing.wholesale ? withVariantBase(pricing.wholesale, variantPriceOverride) : null;
  if (wholesale && qty >= moq) {
    return calculateWholesalePrice(retail, wholesale, qty, moq);
  }
  return calculateRetailPrice(retail, qty);
}

export const RETAIL_MAX_UNITS = 25;

export const COD_LIMIT = 5000;
export const GST_RATE = 0.05;
export const SERVICE_FEE = 1.5;
export const SHIPPING_FEE = 25;
export const FREE_SHIPPING_THRESHOLD = 0; // Free shipping now managed via quota system, not auto-threshold

export function calculateOrderTotals(subtotal: number, couponDiscount = 0, obDiscount = 0) {
  const discount = round2(couponDiscount);
  const afterDiscount = Math.max(0, subtotal - discount);
  const gst = round2(afterDiscount * GST_RATE);
  const shippingFee = SHIPPING_FEE; // Always charge shipping; free shipping via coupon/quota only
  const serviceFee = SERVICE_FEE;
  const total = round2(afterDiscount + gst + shippingFee + serviceFee - obDiscount);
  return { subtotal: round2(subtotal), discount, gst, shippingFee, serviceFee, obDiscount, total };
}

export function isCodAllowed(total: number): boolean {
  return total <= COD_LIMIT;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
