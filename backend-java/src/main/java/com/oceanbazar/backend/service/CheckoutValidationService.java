package com.oceanbazar.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class CheckoutValidationService {

    private final PricingService pricingService;
    private final CouponValidationService couponValidationService;
    private final ObPointsRulesService obPointsRulesService;
    private final CodRulesService codRulesService;

    private static final Set<String> VALID_PAYMENT_METHODS = Set.of("cod", "bkash", "nagad", "rocket", "upay", "sslcommerz");

    public static class CheckoutLineItem {
        public String productId;
        public String variantId;
        public String productTitle;
        public int quantity;
        public int stock;
        public int moq;
        public PricingService.PricingRow retailPricing;
        public PricingService.PricingRow wholesalePricing;
    }

    public static class CheckoutInput {
        public String userType;
        public List<CheckoutLineItem> items;
        public String paymentMethod;
        public com.oceanbazar.backend.entity.CouponEntity coupon;
        public int obPointsToRedeem;
        public int obBalance;
        public BigDecimal lifetimeSpend;
        public BigDecimal orderTotal;
        public int pendingCodCount;
        public boolean codAbuse;
        public String district;
    }

    public static class CheckoutLineResult {
        public String productId;
        public String variantId;
        public String productTitle;
        public int quantity;
        public BigDecimal unitPrice;
        public BigDecimal lineTotal;
        public BigDecimal discountPct;
        public int tierApplied;
    }

    public static class CheckoutResult {
        public boolean valid;
        public List<String> errors = new ArrayList<>();
        public List<CheckoutLineResult> lines = new ArrayList<>();
        public PricingService.OrderTotals totals;
        public BigDecimal couponDiscount = BigDecimal.ZERO;
        public boolean freeShipping;
        public BigDecimal obDiscount = BigDecimal.ZERO;
        public int obPointsEarned;
        public boolean codAllowed;
    }

    public CheckoutResult validate(CheckoutInput input) {
        CheckoutResult result = new CheckoutResult();

        if (input.items == null || input.items.isEmpty()) {
            result.errors.add("Cart is empty.");
        }
        if (!VALID_PAYMENT_METHODS.contains(input.paymentMethod)) {
            result.errors.add("Invalid payment method: \"" + input.paymentMethod + "\".");
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        if (input.items != null) {
            for (CheckoutLineItem item : input.items) {
                if (item.quantity < 1) {
                    result.errors.add(item.productTitle + ": quantity must be >= 1."); continue;
                }
                if (item.quantity > item.stock) {
                    result.errors.add(item.productTitle + ": only " + item.stock + " in stock, requested " + item.quantity + ".");
                }
                PricingService.PricingResult pr = pricingService.calculatePrice(input.userType, item.retailPricing, item.wholesalePricing, item.quantity, item.moq);
                CheckoutLineResult line = new CheckoutLineResult();
                line.productId = item.productId;
                line.variantId = item.variantId;
                line.productTitle = item.productTitle;
                line.quantity = item.quantity;
                line.unitPrice = pr.unitPrice;
                line.lineTotal = pr.lineTotal;
                line.discountPct = pr.discountPct;
                line.tierApplied = pr.tierApplied;
                result.lines.add(line);
                subtotal = subtotal.add(pr.lineTotal);
            }
        }

        if (input.coupon != null) {
            CouponValidationService.CouponValidationResult cv = couponValidationService.validate(input.coupon, subtotal);
            if (!cv.valid) result.errors.add(cv.error);
            else { result.couponDiscount = cv.discountAmount; result.freeShipping = cv.freeShipping; }
        }

        if (input.obPointsToRedeem > 0) {
            ObPointsRulesService.OBTier tier = obPointsRulesService.getTier(input.lifetimeSpend);
            ObPointsRulesService.RedemptionResult rv = obPointsRulesService.validateRedemption(tier, input.obBalance, input.obPointsToRedeem);
            if (!rv.valid) result.errors.add(rv.error);
            else result.obDiscount = BigDecimal.valueOf(rv.bdtValue);
        }

        PricingService.OrderTotals totals = pricingService.calculateOrderTotals(subtotal, result.couponDiscount, result.obDiscount);
        if (result.freeShipping && totals.shippingFee.compareTo(BigDecimal.ZERO) > 0) {
            totals.total = PricingService.round2(totals.total.subtract(totals.shippingFee));
            totals.shippingFee = BigDecimal.ZERO;
        }
        result.totals = totals;

        CodRulesService.CodEligibilityResult cod = codRulesService.check(totals.total, input.pendingCodCount, input.codAbuse, input.district);
        result.codAllowed = cod.allowed;
        if ("cod".equals(input.paymentMethod) && !cod.allowed) result.errors.addAll(cod.reasons);

        result.obPointsEarned = obPointsRulesService.calculatePointsEarned(totals.total);
        result.valid = result.errors.isEmpty();
        return result;
    }
}
