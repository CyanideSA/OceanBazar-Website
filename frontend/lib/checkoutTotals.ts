import { calculateOrderTotals, GST_RATE, BASE_SHIPPING_FEE, BASE_SERVICE_FEE, FREE_FEES_THRESHOLD } from '@/lib/pricing';

export type CouponPreview = { type: string; value: number };

export function couponWaivers(type: string | null | undefined): {
  freeShipping: boolean;
  freeService: boolean;
  freeVat: boolean;
} {
  if (type === 'free_fees') return { freeShipping: true, freeService: true, freeVat: true };
  return {
    freeShipping: type === 'free_shipping',
    freeService: type === 'free_service',
    freeVat: type === 'free_vat',
  };
}

/** Match backend order coupon logic. */
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
  const w = couponWaivers(coupon?.type);
  const totals = calculateOrderTotals(merchandiseSubtotal, cDisc, obBdtDiscount, {
    couponFreeShipping: w.freeShipping,
    couponFreeService: w.freeService,
    couponFreeVat: w.freeVat,
    retailQuantityOrder: extras?.retailQuantityOrder,
    priceInclusive: true,
  });
  return totals;
}

export const checkoutMeta = {
  gstRate: GST_RATE,
  shippingFlat: BASE_SHIPPING_FEE,
  serviceFlat: BASE_SERVICE_FEE,
  freeFeesThreshold: FREE_FEES_THRESHOLD,
  codLimit: 5000,
  /** SSLCommerz fee is merchant expense — never shown or added to customer checkout */
  gatewayFeeRate: 0.025,
  passThroughGatewayFee: false,
  vatInclusive: true,
};

/** VAT rate as a display percentage — 7.5% must not round to "8%". */
export function formatVatPercent(rate: number = GST_RATE): string {
  const percent = rate * 100;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
}

/** Customer-facing SSL / online payment fee (not applied to COD). */
export function customerPaymentFee(
  orderTotalBeforeFee: number,
  paymentMethod: string | null | undefined,
): { feeAmount: number; totalWithFee: number; applied: boolean } {
  const method = String(paymentMethod || '').toLowerCase();
  const online =
    method === 'sslcommerz' ||
    method === 'bkash' ||
    method === 'nagad' ||
    method === 'rocket' ||
    method === 'upay';
  if (!online || !checkoutMeta.passThroughGatewayFee) {
    return { feeAmount: 0, totalWithFee: orderTotalBeforeFee, applied: false };
  }
  const feeAmount = Math.round(orderTotalBeforeFee * checkoutMeta.gatewayFeeRate * 100) / 100;
  return {
    feeAmount,
    totalWithFee: Math.round((orderTotalBeforeFee + feeAmount) * 100) / 100,
    applied: feeAmount > 0,
  };
}
