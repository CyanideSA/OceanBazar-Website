/**
 * Oceanbazar Pricing Engine
 *
 * Supports:
 * - Legacy tiers: tier1MinQty…tier3 (threshold discounts; qty 1 never applies tier discounts).
 * - Tier bands (`tierBands` JSON): each row has minQty, maxQty (null = unlimited for last wholesale tier only), discountPct.
 *
 * Checkout: subtotal ≥ 5000 BDT **and** every line qty ≤ retail max → waived shipping + service fee.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PricingMode = 'non_tiered' | 'tiered';

export interface TierBand {
  minQty: number;
  /** null → unlimited quantity (allowed only on the last wholesale band) */
  maxQty: number | null;
  discountPct: number;
}

export interface PricingRow {
  price: number;
  compareAt?: number | null;
  tier1MinQty?: number | null;
  tier1Discount?: number | null;
  tier2MinQty?: number | null;
  tier2Discount?: number | null;
  tier3MinQty?: number | null;
  tier3Discount?: number | null;
  /** When set with length ≥ 1, takes precedence over legacy tier columns. */
  tierBands?: TierBand[] | null;
}

export interface PricingResult {
  unitPrice: number;
  originalPrice: number;
  discountPct: number;
  lineTotal: number;
  /** 1-based band index when using tierBands; legacy 0–3 otherwise */
  tierApplied: number;
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
  /** Net taxable merchandise (after discount), before or excluding VAT depending on mode */
  taxableAmount: number;
  vatInclusive: boolean;
  vatRate: number;
}

export interface OrderTotalsOptions {
  couponFreeShipping?: boolean;
  couponFreeService?: boolean;
  couponFreeVat?: boolean;
  /** Every cart line qty is within retail-tier max for that product */
  retailQuantityOrder?: boolean;
  /** Fraction e.g. 0.05 — defaults to GST_RATE when omitted */
  vatRate?: number;
  /** When true, merchandise prices already include VAT (do not add VAT on top) */
  priceInclusive?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const GST_RATE = 0.075;
/** Customers pay merchandise (VAT-inclusive) + shipping only — no service fee. */
export const BASE_SERVICE_FEE = 0;
export const BASE_SHIPPING_FEE = 25.0;
export const FREE_FEES_THRESHOLD = 5000;
export const COD_LIMIT = 5000;

export const RETAIL_MAX_UNITS = 25;

export const MIN_RETAIL_QTY = 1;

export const SERVICE_FEE = BASE_SERVICE_FEE;
export const SHIPPING_FEE = BASE_SHIPPING_FEE;
export const FREE_SHIPPING_THRESHOLD = FREE_FEES_THRESHOLD;
export const FREE_SHIPPING_MIN_ORDER = FREE_FEES_THRESHOLD;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse tier bands from DB JSON */
export function parseTierBands(raw: unknown): TierBand[] | null {
  if (!raw) return null;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const bands: TierBand[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== 'object') return null;
    const o = row as Record<string, unknown>;
    const minQty = Math.floor(Number(o.minQty));
    if (!Number.isFinite(minQty) || minQty < 1) return null;
    let maxQty: number | null;
    if (o.maxQty == null || o.maxQty === '') maxQty = null;
    else {
      maxQty = Math.floor(Number(o.maxQty));
      if (!Number.isFinite(maxQty)) return null;
    }
    const discountPct = Number(o.discountPct);
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) return null;
    if (maxQty !== null && maxQty < minQty) return null;
    bands.push({ minQty, maxQty, discountPct });
  }
  return bands;
}

function clampTierApplied(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(127, Math.floor(n));
}

function resolveBandDiscount(
  bands: TierBand[],
  qty: number,
  allowTrailingUnbounded: boolean,
): { discountPct: number; tierApplied: number } {
  for (let i = bands.length - 1; i >= 0; i--) {
    const b = bands[i];
    const isLast = i === bands.length - 1;
    if (qty < b.minQty) continue;
    const unboundedOk = isLast && allowTrailingUnbounded && b.maxQty == null;
    if (unboundedOk || (b.maxQty != null && qty <= b.maxQty))
      return { discountPct: Number(b.discountPct), tierApplied: i + 1 };
  }
  return { discountPct: 0, tierApplied: 0 };
}

/** Legacy: pick the highest tier whose minQty threshold is met when qty ≥ min. */
function resolveLegacyTier(
  row: PricingRow,
  qty: number,
): { discountPct: number; tierApplied: number } {
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

function buildResult(basePrice: number, discountPct: number, tierApplied: number, qty: number): PricingResult {
  const unitPrice = round2(basePrice * (1 - discountPct / 100));
  const lineTotal = round2(unitPrice * qty);
  const savings = round2((basePrice - unitPrice) * qty);
  return {
    unitPrice,
    originalPrice: basePrice,
    discountPct,
    lineTotal,
    tierApplied: clampTierApplied(tierApplied),
    savings,
  };
}

/** Last retail tier max qty (caps retail customer's order size). */
export function getRetailMaxQty(retailPricing: PricingRow): number {
  const bands = parseTierBands(retailPricing.tierBands);
  if (bands?.length) {
    const last = bands[bands.length - 1];
    if (last.maxQty != null) return last.maxQty;
    return RETAIL_MAX_UNITS;
  }
  return retailPricing.tier3MinQty ?? RETAIL_MAX_UNITS;
}

/** Last wholesale tier max; null ⇒ unlimited */
export function getWholesaleCapQty(wholesalePricing: PricingRow): number | null {
  const bands = parseTierBands(wholesalePricing.tierBands);
  if (bands?.length) {
    const last = bands[bands.length - 1];
    return last.maxQty;
  }
  return null;
}

// ─── Admin validation ─────────────────────────────────────────────────────────

export interface TierValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTierBandsRetail(bands: TierBand[]): TierValidationResult {
  const errors: string[] = [];
  if (!bands.length) return { valid: false, errors: ['Add at least one retail tier'] };
  let prevMax: number | undefined;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    if (b.maxQty == null) errors.push('Each retail tier must have a max qty');
    if (b.maxQty != null && b.maxQty < b.minQty) errors.push(`Tier ${i + 1}: max qty must be ≥ min qty`);
    if (i === 0) {
      if (b.minQty !== 1) errors.push('First retail tier must start at min qty 1');
    } else if (prevMax !== undefined && b.minQty !== prevMax + 1)
      errors.push(`Tier ${i + 1}: min qty must equal previous max + 1 (expected ${prevMax + 1})`);
    if (b.maxQty != null) prevMax = b.maxQty;
  }
  return { valid: errors.length === 0, errors };
}

export function validateTierBandsWholesale(
  wholesale: TierBand[],
  retailTailMax: number,
): TierValidationResult {
  const errors: string[] = [];
  if (!wholesale.length) return { valid: false, errors: ['Add at least one wholesale tier'] };
  if (wholesale[0].minQty !== retailTailMax + 1)
    errors.push(`First wholesale min qty must be ${retailTailMax + 1} (last retail max + 1)`);
  for (let i = 0; i < wholesale.length; i++) {
    const b = wholesale[i];
    const isLast = i === wholesale.length - 1;
    if (b.maxQty != null && b.maxQty < b.minQty) errors.push(`Wholesale tier ${i + 1}: max qty must be ≥ min qty`);
    if (i > 0) {
      const prev = wholesale[i - 1];
      if (prev.maxQty != null && b.minQty !== prev.maxQty + 1)
        errors.push(`Wholesale tier ${i + 1}: min qty must be ${prev.maxQty + 1}`);
    }
    if (!isLast && b.maxQty == null) errors.push('Only the final wholesale tier may omit max qty');
  }
  return { valid: errors.length === 0, errors };
}

export function validateTieredPricing(retail: PricingRow, wholesale: PricingRow): TierValidationResult {
  const errors: string[] = [];
  const q1 = retail.tier1MinQty ?? 0;
  const q2 = retail.tier2MinQty ?? 0;
  const q3 = retail.tier3MinQty ?? 0;
  const q4 = wholesale.tier1MinQty ?? 0;
  const q5 = wholesale.tier2MinQty ?? 0;

  if (q1 >= q2 || q2 >= q3 || q3 >= q4 || q4 >= q5) {
    errors.push('Quantity gates must follow: Q1 < Q2 < Q3 < Q4 < Q5');
  }

  const rd1 = Number(retail.tier1Discount ?? 0);
  const rd2 = Number(retail.tier2Discount ?? 0);
  const rd3 = Number(retail.tier3Discount ?? 0);
  const wd1 = Number(wholesale.tier1Discount ?? 0);
  const wd2 = Number(wholesale.tier2Discount ?? 0);
  const wd3 = Number(wholesale.tier3Discount ?? 0);

  if (!(rd1 < rd2 && rd2 < rd3 && rd3 < wd1 && wd1 < wd2 && wd2 < wd3)) {
    errors.push('Discounts must increase: retail T1 < T2 < T3 < wholesale T1 < T2 < T3');
  }

  return { valid: errors.length === 0, errors };
}

// ─── Price calculators ────────────────────────────────────────────────────────

export function calculateRetailPrice(pricing: PricingRow, qty: number): PricingResult {
  if (qty < 1) qty = 1;
  const bands = parseTierBands(pricing.tierBands);
  if (bands?.length) {
    const r = resolveBandDiscount(bands, qty, false);
    return buildResult(pricing.price, r.discountPct, r.tierApplied, qty);
  }
  const { discountPct, tierApplied } = qty > 1 ? resolveLegacyTier(pricing, qty) : { discountPct: 0, tierApplied: 0 };
  return buildResult(pricing.price, discountPct, tierApplied, qty);
}

export function calculateWholesalePrice(
  retailPricing: PricingRow,
  wholesalePricing: PricingRow,
  qty: number,
  moq: number,
): PricingResult {
  if (qty < moq) return calculateRetailPrice(retailPricing, qty);
  const wb = parseTierBands(wholesalePricing.tierBands);
  if (wb?.length) {
    const r = resolveBandDiscount(wb, qty, true);
    return buildResult(wholesalePricing.price, r.discountPct, r.tierApplied, qty);
  }
  const { discountPct, tierApplied } = resolveLegacyTier(wholesalePricing, qty);
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

export const FREE_SHIPPING_TIER = 'Gold';

function normalizeTotalsOpts(freeShippingLegacy?: boolean | OrderTotalsOptions): OrderTotalsOptions {
  if (freeShippingLegacy == null) return {};
  if (typeof freeShippingLegacy === 'boolean') return { couponFreeShipping: freeShippingLegacy };
  return freeShippingLegacy;
}

export function calculateOrderTotals(
  subtotal: number,
  couponDiscount: number = 0,
  obDiscount: number = 0,
  opts?: boolean | OrderTotalsOptions,
): OrderTotals {
  const o = normalizeTotalsOpts(opts);
  const discount = round2(Math.max(0, couponDiscount));
  const afterDiscount = Math.max(0, subtotal - discount);

  const thresholdWaiver = subtotal >= FREE_FEES_THRESHOLD && o.retailQuantityOrder === true;
  const shippingFee = Boolean(o.couponFreeShipping) || thresholdWaiver ? 0 : BASE_SHIPPING_FEE;
  const serviceFee = Boolean(o.couponFreeService) || thresholdWaiver ? 0 : BASE_SERVICE_FEE;

  const vatRate =
    o.vatRate != null && Number.isFinite(Number(o.vatRate)) ? Math.max(0, Number(o.vatRate)) : GST_RATE;
  const priceInclusive = Boolean(o.priceInclusive);
  const waiveVat = Boolean(o.couponFreeVat);

  let gst = 0;
  let taxableAmount = round2(afterDiscount);
  if (!waiveVat && vatRate > 0) {
    if (priceInclusive) {
      taxableAmount = round2(afterDiscount / (1 + vatRate));
      gst = round2(afterDiscount - taxableAmount);
    } else {
      gst = round2(afterDiscount * vatRate);
      taxableAmount = round2(afterDiscount);
    }
  }

  // Inclusive prices already contain VAT — do not add gst again to customer total.
  const merchandiseDue = priceInclusive ? afterDiscount : afterDiscount + gst;
  const clampedOb = round2(Math.min(obDiscount, merchandiseDue + shippingFee + serviceFee));
  const total = round2(Math.max(0, merchandiseDue + shippingFee + serviceFee - clampedOb));

  return {
    subtotal: round2(subtotal),
    discount,
    gst,
    shippingFee,
    serviceFee,
    obDiscount: clampedOb,
    total,
    taxableAmount,
    vatInclusive: priceInclusive,
    vatRate,
  };
}

export function isCodAllowed(total: number): boolean {
  return total <= COD_LIMIT;
}
