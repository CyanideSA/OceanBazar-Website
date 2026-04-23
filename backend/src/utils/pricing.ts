/**
 * Oceanbazar Pricing Engine
 *
 * Pure, testable functions — no DB, no Express.
 *
 * Retail tiers:  qty=1 → 0%  |  tier1 → 5%  |  tier2 → 10%  |  tier3 → 15%
 * Wholesale:     below MOQ → retail pricing applies
 *                meets MOQ → wholesale base price
 *                vol tier1 → 2%  |  vol tier2 → 5%  |  vol tier3 → 8%
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PricingRow {
  price: number;
  compareAt?: number | null;
  tier1MinQty?: number | null;
  tier1Discount?: number | null; // percentage e.g. 5.00
  tier2MinQty?: number | null;
  tier2Discount?: number | null;
  tier3MinQty?: number | null;
  tier3Discount?: number | null;
}

export interface PricingResult {
  unitPrice: number;
  originalPrice: number;
  discountPct: number;
  lineTotal: number;
  tierApplied: 0 | 1 | 2 | 3;
  savings: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  gst: number;
  shippingFee: number;
  serviceFee: number;
  obDiscount: number;
  total: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const GST_RATE = 0.05;
export const SERVICE_FEE = 1.5;
export const SHIPPING_FEE = 25.0;
export const FREE_SHIPPING_THRESHOLD = 0;
export const COD_LIMIT = 5000;
export const RETAIL_MAX_UNITS = 25;

// Wholesale below-MOQ floor: ensure the buyer can never game below-MOQ qty
// to get wholesale prices.
export const MIN_RETAIL_QTY = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Pick the highest tier whose minQty threshold is met. */
function resolveTier(
  row: PricingRow,
  qty: number,
): { discountPct: number; tierApplied: 0 | 1 | 2 | 3 } {
  const t3 = row.tier3MinQty ?? Infinity;
  const t2 = row.tier2MinQty ?? Infinity;
  const t1 = row.tier1MinQty ?? Infinity;

  if (qty >= t3 && row.tier3Discount != null)
    return { discountPct: Number(row.tier3Discount), tierApplied: 3 };
  if (qty >= t2 && row.tier2Discount != null)
    return { discountPct: Number(row.tier2Discount), tierApplied: 2 };
  if (qty >= t1 && row.tier1Discount != null)
    return { discountPct: Number(row.tier1Discount), tierApplied: 1 };

  return { discountPct: 0, tierApplied: 0 };
}

function buildResult(
  basePrice: number,
  discountPct: number,
  tierApplied: 0 | 1 | 2 | 3,
  qty: number,
): PricingResult {
  const unitPrice = round2(basePrice * (1 - discountPct / 100));
  const lineTotal = round2(unitPrice * qty);
  const savings = round2((basePrice - unitPrice) * qty);
  return { unitPrice, originalPrice: basePrice, discountPct, lineTotal, tierApplied, savings };
}

// ─── Price calculators ────────────────────────────────────────────────────────

export function calculateRetailPrice(pricing: PricingRow, qty: number): PricingResult {
  if (qty < 1) qty = 1;
  const { discountPct, tierApplied } = qty > 1 ? resolveTier(pricing, qty) : { discountPct: 0, tierApplied: 0 as const };
  return buildResult(pricing.price, discountPct, tierApplied, qty);
}

export function calculateWholesalePrice(
  retailPricing: PricingRow,
  wholesalePricing: PricingRow,
  qty: number,
  moq: number,
): PricingResult {
  if (qty < moq) return calculateRetailPrice(retailPricing, qty);
  const { discountPct, tierApplied } = resolveTier(wholesalePricing, qty);
  return buildResult(wholesalePricing.price, discountPct, tierApplied, qty);
}

export function calculatePrice(
  userType: 'retail' | 'wholesale',
  pricing: { retail: PricingRow; wholesale?: PricingRow | null },
  qty: number,
  moq: number,
): PricingResult {
  if (userType === 'wholesale' && pricing.wholesale) {
    return calculateWholesalePrice(pricing.retail, pricing.wholesale, qty, moq);
  }
  return calculateRetailPrice(pricing.retail, qty);
}

// ─── Order totals ─────────────────────────────────────────────────────────────

export function calculateOrderTotals(
  subtotal: number,
  couponDiscount: number = 0,
  obDiscount: number = 0,
): OrderTotals {
  const discount = round2(Math.max(0, couponDiscount));
  const afterDiscount = Math.max(0, subtotal - discount);
  const gst = round2(afterDiscount * GST_RATE);
  const shippingFee = SHIPPING_FEE;
  const serviceFee = SERVICE_FEE;
  const clampedOb = round2(Math.min(obDiscount, afterDiscount + gst + shippingFee + serviceFee));
  const total = round2(Math.max(0, afterDiscount + gst + shippingFee + serviceFee - clampedOb));

  return { subtotal: round2(subtotal), discount, gst, shippingFee, serviceFee, obDiscount: clampedOb, total };
}

export function isCodAllowed(total: number): boolean {
  return total <= COD_LIMIT;
}
