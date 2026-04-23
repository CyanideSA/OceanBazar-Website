/**
 * Checkout validation — orchestrates pricing, coupon, OB points, COD, and
 * stock rules into a single pre-flight check.
 *
 * Pure logic — caller supplies all data, no DB calls.
 */

import {
  calculatePrice,
  calculateOrderTotals,
  round2,
  RETAIL_MAX_UNITS,
  type PricingRow,
  type PricingResult,
  type OrderTotals,
} from './pricing';
import {
  validateCoupon,
  applyCoupon,
  applyFreeShipping,
  type CouponData,
} from './couponRules';
import {
  validateRedemption,
  wouldUpgradeTier,
  calculatePointsEarned,
  type OBTier,
} from './obPoints';
import {
  checkCodEligibility,
  type CodEligibilityInput,
} from './codRules';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckoutLineItem {
  productId: string;
  variantId?: string;
  productTitle: string;
  quantity: number;
  stock: number;
  moq: number;
  pricing: { retail: PricingRow; wholesale?: PricingRow | null };
}

export interface CheckoutInput {
  userType: 'retail' | 'wholesale';
  items: CheckoutLineItem[];
  paymentMethod: string;
  coupon?: CouponData | null;
  obPointsToRedeem: number;
  obBalance: number;
  obTier: OBTier;
  lifetimeSpend: number;
  codContext: CodEligibilityInput;
}

export interface CheckoutLineResult {
  productId: string;
  variantId?: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountPct: number;
  tierApplied: 0 | 1 | 2 | 3;
}

export interface CheckoutResult {
  valid: boolean;
  errors: string[];
  lines: CheckoutLineResult[];
  totals: OrderTotals;
  couponDiscount: number;
  freeShipping: boolean;
  obDiscount: number;
  obPointsEarned: number;
  tierUpgrade: { upgrades: boolean; from: OBTier; to: OBTier };
  codAllowed: boolean;
}

// ─── Valid payment methods ────────────────────────────────────────────────────

const VALID_PAYMENT_METHODS = new Set([
  'cod', 'bkash', 'nagad', 'rocket', 'upay', 'sslcommerz',
  'installment',
]);

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateCheckout(input: CheckoutInput): CheckoutResult {
  const errors: string[] = [];

  // 1. Cart cannot be empty
  if (input.items.length === 0) {
    errors.push('Cart is empty.');
  }

  // 2. Payment method must be recognized
  if (!VALID_PAYMENT_METHODS.has(input.paymentMethod)) {
    errors.push(`Invalid payment method: "${input.paymentMethod}".`);
  }

  // 3. Validate stock + qty per line item and compute pricing
  const lines: CheckoutLineResult[] = [];
  const stockErrors: string[] = [];

  for (const item of input.items) {
    if (item.quantity < 1) {
      stockErrors.push(`${item.productTitle}: quantity must be ≥ 1.`);
      continue;
    }
    if (item.quantity > item.stock) {
      stockErrors.push(`${item.productTitle}: only ${item.stock} in stock, requested ${item.quantity}.`);
    }

    const hasWholesale = Boolean(item.pricing.wholesale);
    const isWholesaleQty = hasWholesale && item.quantity >= item.moq;
    if (input.userType === 'retail' && !isWholesaleQty && item.quantity > RETAIL_MAX_UNITS) {
      stockErrors.push(
        `${item.productTitle}: retail orders are limited to ${RETAIL_MAX_UNITS} units. Add ${item.moq}+ units for wholesale pricing.`,
      );
    }

    const pr: PricingResult = calculatePrice(
      input.userType,
      item.pricing,
      item.quantity,
      item.moq,
    );

    lines.push({
      productId: item.productId,
      variantId: item.variantId,
      productTitle: item.productTitle,
      quantity: item.quantity,
      unitPrice: pr.unitPrice,
      lineTotal: pr.lineTotal,
      discountPct: pr.discountPct,
      tierApplied: pr.tierApplied,
    });
  }
  errors.push(...stockErrors);

  // 4. Subtotal
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));

  // 5. Coupon
  let couponDiscount = 0;
  let freeShipping = false;

  if (input.coupon) {
    const cv = validateCoupon({ coupon: input.coupon, subtotal });
    if (!cv.valid) {
      errors.push(cv.error!);
    } else {
      const applied = applyCoupon(input.coupon, subtotal);
      couponDiscount = applied.discountAmount;
      freeShipping = applied.freeShipping;
    }
  }

  // 6. OB points
  let obDiscount = 0;
  if (input.obPointsToRedeem > 0) {
    const rv = validateRedemption(input.obTier, input.obBalance, input.obPointsToRedeem);
    if (!rv.valid) {
      errors.push(rv.error!);
    } else {
      obDiscount = rv.bdtValue;
    }
  }

  // 7. Order totals
  let totals = calculateOrderTotals(subtotal, couponDiscount, obDiscount);
  if (freeShipping) {
    const patched = applyFreeShipping(totals);
    totals = { ...totals, ...patched };
  }

  // 8. COD check
  const codResult = checkCodEligibility({
    ...input.codContext,
    orderTotal: totals.total,
  });
  if (input.paymentMethod === 'cod' && !codResult.allowed) {
    errors.push(...codResult.reasons);
  }

  // 9. OB points earned + tier upgrade preview
  const obPointsEarned = calculatePointsEarned(totals.total);
  const tierUpgrade = wouldUpgradeTier(input.lifetimeSpend, totals.total);

  return {
    valid: errors.length === 0,
    errors,
    lines,
    totals,
    couponDiscount,
    freeShipping,
    obDiscount,
    obPointsEarned,
    tierUpgrade,
    codAllowed: codResult.allowed,
  };
}
