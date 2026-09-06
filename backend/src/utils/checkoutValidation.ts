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
  getRetailMaxQty,
  getWholesaleCapQty,
  type PricingRow,
  type PricingResult,
  type OrderTotals,
} from './pricing';
import {
  validateCoupon,
  applyCoupon,
  type CouponData,
} from './couponRules';
import {
  validateRedemption,
  wouldUpgradeTier,
  calculatePointsEarned,
  DEFAULT_OB_POINTS_RULES,
  type OBTier,
  type ObPointsRules,
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
  obRules?: ObPointsRules;
  /** Optional active tax policy from taxVatSystem (defaults preserve GST_RATE exclusive) */
  taxPolicy?: { vatRate: number; priceInclusive: boolean } | null;
}

export interface CheckoutLineResult {
  productId: string;
  variantId?: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountPct: number;
  tierApplied: number;
}

export interface CheckoutResult {
  valid: boolean;
  errors: string[];
  lines: CheckoutLineResult[];
  totals: OrderTotals;
  couponDiscount: number;
  freeShipping: boolean;
  freeService: boolean;
  freeVat: boolean;
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
    const retailMaxQty = getRetailMaxQty(item.pricing.retail);
    if (input.userType === 'retail' && item.quantity > retailMaxQty) {
      stockErrors.push(
        `${item.productTitle}: retail orders are limited to ${retailMaxQty} units. Register as wholesale for higher quantities.`,
      );
    }
    const wCap =
      input.userType === 'wholesale' && item.pricing.wholesale
        ? getWholesaleCapQty(item.pricing.wholesale)
        : null;
    if (wCap != null && item.quantity > wCap) {
      stockErrors.push(`${item.productTitle}: wholesale quantity is capped at ${wCap} units for this product.`);
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
  let freeService = false;
  let freeVat = false;

  if (input.coupon) {
    const cv = validateCoupon({ coupon: input.coupon, subtotal });
    if (!cv.valid) {
      errors.push(cv.error!);
    } else {
      const applied = applyCoupon(input.coupon, subtotal);
      couponDiscount = applied.discountAmount;
      freeShipping = applied.freeShipping;
      freeService = applied.freeService;
      freeVat = applied.freeVat;
    }
  }

  // 6. OB points
  const obRules = input.obRules ?? DEFAULT_OB_POINTS_RULES;
  let obDiscount = 0;
  if (input.obPointsToRedeem > 0) {
    const rv = validateRedemption(input.obTier, input.obBalance, input.obPointsToRedeem, obRules);
    if (!rv.valid) {
      errors.push(rv.error!);
    } else {
      obDiscount = rv.bdtValue;
    }
  }

  // 7. Order totals — shipping/service waiver when coupon OR (≥5000 AND every line stays within retail qty cap)
  const retailQuantityOrder = input.items.every((it) => it.quantity <= getRetailMaxQty(it.pricing.retail));
  const totals = calculateOrderTotals(subtotal, couponDiscount, obDiscount, {
    couponFreeShipping: freeShipping,
    couponFreeService: freeService,
    couponFreeVat: freeVat,
    retailQuantityOrder,
    vatRate: input.taxPolicy?.vatRate,
    priceInclusive: input.taxPolicy?.priceInclusive,
  });


  // 8. COD check
  const codResult = checkCodEligibility({
    ...input.codContext,
    orderTotal: totals.total,
  });
  if (input.paymentMethod === 'cod' && !codResult.allowed) {
    errors.push(...codResult.reasons);
  }

  // 9. OB points earned + tier upgrade preview
  const obPointsEarned = calculatePointsEarned(totals.total, obRules);
  const tierUpgrade = wouldUpgradeTier(input.lifetimeSpend, totals.total, obRules);

  return {
    valid: errors.length === 0,
    errors,
    lines,
    totals,
    couponDiscount,
    freeShipping,
    freeService,
    freeVat,
    obDiscount,
    obPointsEarned,
    tierUpgrade,
    codAllowed: codResult.allowed,
  };
}
