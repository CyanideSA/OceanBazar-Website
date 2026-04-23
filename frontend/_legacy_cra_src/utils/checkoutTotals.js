/**
 * Mirrors backend CheckoutTotalsCalculator.java — change both together.
 */
export const GST_RATE = 0.05;
export const SERVICE_FEE_FLAT = 1.5;
export const SHIPPING_FLAT = 25;

/**
 * @param {number} merchandiseSubtotal line items sum before tax, fees, shipping
 */
export function computeCheckoutTotals(merchandiseSubtotal) {
  const sub = Math.max(0, Number(merchandiseSubtotal) || 0);
  if (sub <= 0) {
    return {
      merchandiseSubtotal: 0,
      gst: 0,
      serviceFee: 0,
      shipping: 0,
      total: 0,
    };
  }
  const shipping = SHIPPING_FLAT;
  const gst = Math.round(sub * GST_RATE * 100) / 100;
  const serviceFee = SERVICE_FEE_FLAT;
  const total = Math.round((sub + shipping + gst + serviceFee) * 100) / 100;
  return { merchandiseSubtotal: sub, gst, serviceFee, shipping, total };
}
