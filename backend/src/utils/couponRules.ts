/**
 * Coupon validation & application — pure logic, no DB.
 *
 * Coupon types:
 *   percent       — percentage off subtotal (capped at 100%)
 *   fixed         — flat BDT amount off subtotal (cannot exceed subtotal)
 *   free_shipping — removes shipping fee
 */

import { round2, SHIPPING_FEE } from './pricing';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CouponType = 'percent' | 'fixed' | 'free_shipping';

export interface CouponData {
  id: number;
  code: string;
  type: CouponType;
  value: number;       // pct for percent, BDT for fixed, ignored for free_shipping
  minOrder: number;    // minimum subtotal
  maxUses: number | null;
  usedCount: number;
  startsAt: Date;
  expiresAt: Date | null;
  active: boolean;
}

export interface CouponValidationInput {
  coupon: CouponData;
  subtotal: number;
  now?: Date;
  userPreviousUses?: number; // per-user usage cap (future extension)
}

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
}

export interface CouponApplicationResult {
  discountAmount: number;
  freeShipping: boolean;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateCoupon(input: CouponValidationInput): CouponValidationResult {
  const { coupon, subtotal, now = new Date() } = input;

  if (!coupon.active) {
    return { valid: false, error: 'This coupon is no longer active.' };
  }

  if (now < coupon.startsAt) {
    return { valid: false, error: 'This coupon is not yet valid.' };
  }

  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { valid: false, error: 'This coupon has expired.' };
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, error: 'This coupon has reached its usage limit.' };
  }

  if (subtotal < coupon.minOrder) {
    return {
      valid: false,
      error: `Minimum order of ${coupon.minOrder} BDT required. Your subtotal is ${round2(subtotal)} BDT.`,
    };
  }

  return { valid: true };
}

// ─── Application ──────────────────────────────────────────────────────────────

export function applyCoupon(
  coupon: CouponData,
  subtotal: number,
): CouponApplicationResult {
  switch (coupon.type) {
    case 'percent': {
      const pct = Math.min(100, Math.max(0, coupon.value));
      const raw = (subtotal * pct) / 100;
      return { discountAmount: round2(Math.min(raw, subtotal)), freeShipping: false };
    }
    case 'fixed': {
      return { discountAmount: round2(Math.min(coupon.value, subtotal)), freeShipping: false };
    }
    case 'free_shipping': {
      return { discountAmount: 0, freeShipping: true };
    }
    default: {
      const _exhaustive: never = coupon.type;
      return { discountAmount: 0, freeShipping: false };
    }
  }
}

/** Convenience: validate then apply in one call. */
export function validateAndApplyCoupon(
  input: CouponValidationInput,
): { valid: false; error: string } | { valid: true; discountAmount: number; freeShipping: boolean } {
  const v = validateCoupon(input);
  if (!v.valid) return { valid: false, error: v.error! };
  const a = applyCoupon(input.coupon, input.subtotal);
  return { valid: true, ...a };
}

/**
 * When free_shipping coupon is used, override shipping fee to 0.
 * Call this AFTER calculateOrderTotals to patch the totals.
 */
export function applyFreeShipping(totals: { shippingFee: number; total: number }): {
  shippingFee: number;
  total: number;
} {
  if (totals.shippingFee === 0) return totals;
  return {
    shippingFee: 0,
    total: round2(totals.total - totals.shippingFee),
  };
}
