package com.oceanbazar.backend.utils;

/**
 * Checkout fee totals (merchandise subtotal → shipping, GST, service fee, grand total).
 * <p>
 * Keep rates in sync with {@code frontend/src/utils/checkoutTotals.js}.
 */
public final class CheckoutTotalsCalculator {

    private CheckoutTotalsCalculator() {}

    public static final double GST_RATE = 0.05;
    public static final double SERVICE_FEE_FLAT = 1.50;
    public static final double SHIPPING_FLAT = 25.0;

    public static final class Totals {
        private final double merchandiseSubtotal;
        private final double shipping;
        private final double gst;
        private final double serviceFee;
        private final double total;

        public Totals(double merchandiseSubtotal, double shipping, double gst, double serviceFee, double total) {
            this.merchandiseSubtotal = merchandiseSubtotal;
            this.shipping = shipping;
            this.gst = gst;
            this.serviceFee = serviceFee;
            this.total = total;
        }

        public double getMerchandiseSubtotal() {
            return merchandiseSubtotal;
        }

        public double getShipping() {
            return shipping;
        }

        public double getGst() {
            return gst;
        }

        public double getServiceFee() {
            return serviceFee;
        }

        public double getTotal() {
            return total;
        }
    }

    /**
     * @param merchandiseSubtotal sum of line totals (before tax/fees/shipping)
     */
    public static Totals compute(double merchandiseSubtotal) {
        double sub = merchandiseSubtotal > 0 ? merchandiseSubtotal : 0.0;
        if (sub <= 0) {
            return new Totals(0.0, 0.0, 0.0, 0.0, 0.0);
        }
        double shipping = SHIPPING_FLAT;
        double gst = round2(sub * GST_RATE);
        double serviceFee = SERVICE_FEE_FLAT;
        double total = round2(sub + shipping + gst + serviceFee);
        return new Totals(sub, shipping, gst, serviceFee, total);
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
