import { calculateOrderTotals, GST_RATE, BASE_SHIPPING_FEE, BASE_SERVICE_FEE, FREE_FEES_THRESHOLD } from '@/lib/pricing';

export type CouponPreview = { type: string; value: number };

/** Match backend order coupon logic (percent / fixed / free_shipping). */
export function couponDiscountAmount(subtotal: number, coupon: CouponPreview | null): number {
  if (!coupon) return 0;
  if (coupon.type === 'percent') return Math.round(((subtotal * coupon.value) / 100) * 100) / 100;
  if (coupon.type === 'fixed') return coupon.value;
  return 0;
}

export function previewOrderTotals(
  merchandiseSubtotal: number,
  coupon: CouponPreview | null,
  obBdtDiscount: number,
  extras?: { retailQuantityOrder?: boolean },
) {
  const cDisc = couponDiscountAmount(merchandiseSubtotal, coupon);
  const couponFreeShipping = coupon?.type === 'free_shipping';
  const totals = calculateOrderTotals(merchandiseSubtotal, cDisc, obBdtDiscount, {
    couponFreeShipping,
    retailQuantityOrder: extras?.retailQuantityOrder,
  });
  return totals;
}

export const checkoutMeta = {
  gstRate: GST_RATE,
  shippingFlat: BASE_SHIPPING_FEE,
  serviceFlat: BASE_SERVICE_FEE,
  freeFeesThreshold: FREE_FEES_THRESHOLD,
};
