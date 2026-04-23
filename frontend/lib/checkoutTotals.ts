import { calculateOrderTotals, GST_RATE, SHIPPING_FEE, SERVICE_FEE } from '@/lib/pricing';

export type CouponPreview = { type: string; value: number };

/** Match backend order coupon logic (percent / fixed). free_shipping handled as label only in UI. */
export function couponDiscountAmount(subtotal: number, coupon: CouponPreview | null): number {
  if (!coupon) return 0;
  if (coupon.type === 'percent') return Math.round(((subtotal * coupon.value) / 100) * 100) / 100;
  if (coupon.type === 'fixed') return coupon.value;
  return 0;
}

export function previewOrderTotals(
  merchandiseSubtotal: number,
  coupon: CouponPreview | null,
  obBdtDiscount: number
) {
  const cDisc = couponDiscountAmount(merchandiseSubtotal, coupon);
  return calculateOrderTotals(merchandiseSubtotal, cDisc, obBdtDiscount);
}

export const checkoutMeta = {
  gstRate: GST_RATE,
  shippingFlat: SHIPPING_FEE,
  serviceFlat: SERVICE_FEE,
};
