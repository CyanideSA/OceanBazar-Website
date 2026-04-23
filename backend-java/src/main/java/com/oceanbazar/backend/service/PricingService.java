package com.oceanbazar.backend.service;

import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class PricingService {

    public static final BigDecimal GST_RATE = new BigDecimal("0.05");
    public static final BigDecimal SERVICE_FEE = new BigDecimal("1.50");
    public static final BigDecimal SHIPPING_FEE = new BigDecimal("25.00");
    public static final BigDecimal FREE_SHIPPING_THRESHOLD = new BigDecimal("1000");
    public static final BigDecimal COD_LIMIT = new BigDecimal("5000");

    public static BigDecimal round2(BigDecimal n) {
        return n.setScale(2, RoundingMode.HALF_UP);
    }

    public static class PricingRow {
        public BigDecimal price;
        public BigDecimal compareAt;
        public Integer tier1MinQty;
        public BigDecimal tier1Discount;
        public Integer tier2MinQty;
        public BigDecimal tier2Discount;
        public Integer tier3MinQty;
        public BigDecimal tier3Discount;
    }

    public static class PricingResult {
        public BigDecimal unitPrice;
        public BigDecimal originalPrice;
        public BigDecimal discountPct;
        public BigDecimal lineTotal;
        public int tierApplied;
        public BigDecimal savings;
    }

    public static class OrderTotals {
        public BigDecimal subtotal;
        public BigDecimal discount;
        public BigDecimal gst;
        public BigDecimal shippingFee;
        public BigDecimal serviceFee;
        public BigDecimal obDiscount;
        public BigDecimal total;
    }

    private static int[] resolveTier(PricingRow row, int qty) {
        int t3 = row.tier3MinQty != null ? row.tier3MinQty : Integer.MAX_VALUE;
        int t2 = row.tier2MinQty != null ? row.tier2MinQty : Integer.MAX_VALUE;
        int t1 = row.tier1MinQty != null ? row.tier1MinQty : Integer.MAX_VALUE;

        if (qty >= t3 && row.tier3Discount != null) return new int[]{row.tier3Discount.intValue(), 3};
        if (qty >= t2 && row.tier2Discount != null) return new int[]{row.tier2Discount.intValue(), 2};
        if (qty >= t1 && row.tier1Discount != null) return new int[]{row.tier1Discount.intValue(), 1};
        return new int[]{0, 0};
    }

    private static PricingResult buildResult(BigDecimal basePrice, BigDecimal discountPct, int tierApplied, int qty) {
        BigDecimal factor = BigDecimal.ONE.subtract(discountPct.divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP));
        BigDecimal unitPrice = round2(basePrice.multiply(factor));
        BigDecimal lineTotal = round2(unitPrice.multiply(BigDecimal.valueOf(qty)));
        BigDecimal savings = round2(basePrice.subtract(unitPrice).multiply(BigDecimal.valueOf(qty)));

        PricingResult r = new PricingResult();
        r.unitPrice = unitPrice;
        r.originalPrice = basePrice;
        r.discountPct = discountPct;
        r.lineTotal = lineTotal;
        r.tierApplied = tierApplied;
        r.savings = savings;
        return r;
    }

    public PricingResult calculateRetailPrice(PricingRow pricing, int qty) {
        if (qty < 1) qty = 1;
        int[] tier = qty > 1 ? resolveTier(pricing, qty) : new int[]{0, 0};
        return buildResult(pricing.price, BigDecimal.valueOf(tier[0]), tier[1], qty);
    }

    public PricingResult calculateWholesalePrice(PricingRow retail, PricingRow wholesale, int qty, int moq) {
        if (qty < moq) return calculateRetailPrice(retail, qty);
        int[] tier = resolveTier(wholesale, qty);
        return buildResult(wholesale.price, BigDecimal.valueOf(tier[0]), tier[1], qty);
    }

    public PricingResult calculatePrice(String userType, PricingRow retail, PricingRow wholesale, int qty, int moq) {
        if ("wholesale".equals(userType) && wholesale != null) {
            return calculateWholesalePrice(retail, wholesale, qty, moq);
        }
        return calculateRetailPrice(retail, qty);
    }

    public OrderTotals calculateOrderTotals(BigDecimal subtotal, BigDecimal couponDiscount, BigDecimal obDiscount) {
        BigDecimal discount = round2(couponDiscount.max(BigDecimal.ZERO));
        BigDecimal afterDiscount = subtotal.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal gst = round2(afterDiscount.multiply(GST_RATE));
        BigDecimal shipping = afterDiscount.compareTo(FREE_SHIPPING_THRESHOLD) >= 0 ? BigDecimal.ZERO : SHIPPING_FEE;
        BigDecimal service = SERVICE_FEE;
        BigDecimal maxOb = afterDiscount.add(gst).add(shipping).add(service);
        BigDecimal clampedOb = round2(obDiscount.min(maxOb));
        BigDecimal total = round2(afterDiscount.add(gst).add(shipping).add(service).subtract(clampedOb).max(BigDecimal.ZERO));

        OrderTotals t = new OrderTotals();
        t.subtotal = round2(subtotal);
        t.discount = discount;
        t.gst = gst;
        t.shippingFee = shipping;
        t.serviceFee = service;
        t.obDiscount = clampedOb;
        t.total = total;
        return t;
    }

    public boolean isCodAllowed(BigDecimal total) {
        return total.compareTo(COD_LIMIT) <= 0;
    }
}
