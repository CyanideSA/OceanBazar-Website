/**
 * Oceanbazar Frontend Pricing Engine
 * Mirrors backend utils/pricing.ts — backend is authoritative.
 */

import type { ProductPricing } from '@/types';

export interface PricingResult {
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
  tierApplied: number;
}

export interface TierBand {
  minQty: number;
  maxQty: number | null;
  discountPct: number;
  price?: number | null;
}

export function parseTierBands(pricing: ProductPricing | null | undefined): TierBand[] {
  const raw = pricing?.tierBands;
  if (!Array.isArray(raw)) return [];
  const bands: TierBand[] = [];
  for (const band of raw) {
      const minQty = Number((band as { minQty?: unknown })?.minQty);
      const maxRaw = (band as { maxQty?: unknown })?.maxQty;
      const maxQty = maxRaw == null || maxRaw === '' ? null : Number(maxRaw);
      const discountPct = Number((band as { discountPct?: unknown })?.discountPct ?? 0);
      const priceRaw = (band as { price?: unknown })?.price;
      const price = priceRaw == null || priceRaw === '' ? null : Number(priceRaw);
      if (!Number.isFinite(minQty) || minQty < 1) continue;
      if (maxQty != null && (!Number.isFinite(maxQty) || maxQty < minQty)) continue;
      if (!Number.isFinite(discountPct) || discountPct < 0) continue;
      bands.push({ minQty, maxQty, discountPct, price });
  }
  return bands.sort((a, b) => a.minQty - b.minQty);
}

function resolveBandForQty(bands: TierBand[], qty: number): { index: number; band: TierBand } | null {
  for (let i = bands.length - 1; i >= 0; i -= 1) {
    const band = bands[i];
    if (qty >= band.minQty && (band.maxQty == null || qty <= band.maxQty)) return { index: i + 1, band };
  }
  return null;
}

export function calculateRetailPrice(pricing: ProductPricing, qty: number): PricingResult {
  const base = pricing.price;
  let discountPct = 0;
  let tierApplied = 0;

  const bands = parseTierBands(pricing);
  if (qty > 1 && bands.length > 0) {
    const resolved = resolveBandForQty(bands, qty);
    if (resolved) {
      tierApplied = resolved.index;
      discountPct = resolved.band.discountPct;
      const explicitPrice = resolved.band.price;
      const unitPrice = round2(
        explicitPrice != null && Number.isFinite(explicitPrice)
          ? explicitPrice
          : base * (1 - discountPct / 100)
      );
      return { unitPrice, discountPct, lineTotal: round2(unitPrice * qty), tierApplied };
    }
  }

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
  let tierApplied = 0;

  const bands = parseTierBands(wholesale);
  if (bands.length > 0) {
    const resolved = resolveBandForQty(bands, qty);
    if (resolved) {
      tierApplied = resolved.index;
      discountPct = resolved.band.discountPct;
      const explicitPrice = resolved.band.price;
      const unitPrice = round2(
        explicitPrice != null && Number.isFinite(explicitPrice)
          ? explicitPrice
          : base * (1 - discountPct / 100)
      );
      return { unitPrice, discountPct, lineTotal: round2(unitPrice * qty), tierApplied };
    }
  }

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
  // Only apply wholesale bands when caller explicitly selects wholesale mode.
  if (userType === 'wholesale' && wholesale && qty >= moq) {
    return calculateWholesalePrice(retail, wholesale, qty, moq);
  }
  return calculateRetailPrice(retail, qty);
}

export const RETAIL_MAX_UNITS = 25;

export const COD_LIMIT = 5000;
export const GST_RATE = 0.075;
/** Customers pay merchandise (VAT-inclusive) + shipping only — no service fee. */
export const BASE_SERVICE_FEE = 0;
export const BASE_SHIPPING_FEE = 25;
export const FREE_FEES_THRESHOLD = 5000;

// Legacy aliases for backward compatibility
export const SERVICE_FEE = BASE_SERVICE_FEE;
export const SHIPPING_FEE = BASE_SHIPPING_FEE;
export const FREE_SHIPPING_THRESHOLD = FREE_FEES_THRESHOLD;

export type OrderTotalsOptions = {
  couponFreeShipping?: boolean;
  couponFreeService?: boolean;
  couponFreeVat?: boolean;
  /** When true (all lines within retail qty caps), subtotal threshold waives shipping+service fees. Mirrors backend pricing. */
  retailQuantityOrder?: boolean;
  vatRate?: number;
  priceInclusive?: boolean;
};

function normalizeTotalsOpts(opts?: boolean | OrderTotalsOptions): OrderTotalsOptions {
  if (opts == null) return {};
  if (typeof opts === 'boolean') return { couponFreeShipping: opts };
  return opts;
}

export function calculateOrderTotals(
  subtotal: number,
  couponDiscount = 0,
  obDiscount = 0,
  opts?: boolean | OrderTotalsOptions,
) {
  const o = normalizeTotalsOpts(opts);
  const discount = round2(couponDiscount);
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
