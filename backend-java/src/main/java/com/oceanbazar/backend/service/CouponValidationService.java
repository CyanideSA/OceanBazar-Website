package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.CouponEntity;
import com.oceanbazar.backend.entity.enums.CouponType;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.Instant;

@Service
public class CouponValidationService {

    public static class CouponValidationResult {
        public boolean valid;
        public String error;
        public BigDecimal discountAmount = BigDecimal.ZERO;
        public boolean freeShipping = false;
    }

    public CouponValidationResult validate(CouponEntity coupon, BigDecimal subtotal) {
        CouponValidationResult r = new CouponValidationResult();
        Instant now = Instant.now();

        if (!Boolean.TRUE.equals(coupon.getActive())) {
            r.valid = false; r.error = "This coupon is no longer active."; return r;
        }
        if (coupon.getStartsAt() != null && now.isBefore(coupon.getStartsAt())) {
            r.valid = false; r.error = "This coupon is not yet valid."; return r;
        }
        if (coupon.getExpiresAt() != null && now.isAfter(coupon.getExpiresAt())) {
            r.valid = false; r.error = "This coupon has expired."; return r;
        }
        if (coupon.getMaxUses() != null && coupon.getUsedCount() >= coupon.getMaxUses()) {
            r.valid = false; r.error = "This coupon has reached its usage limit."; return r;
        }
        if (subtotal.compareTo(coupon.getMinOrder()) < 0) {
            r.valid = false;
            r.error = "Minimum order of " + coupon.getMinOrder() + " BDT required. Your subtotal is " + PricingService.round2(subtotal) + " BDT.";
            return r;
        }

        r.valid = true;
        apply(coupon, subtotal, r);
        return r;
    }

    private void apply(CouponEntity coupon, BigDecimal subtotal, CouponValidationResult r) {
        CouponType type = coupon.getType();
        BigDecimal value = coupon.getValue();

        switch (type) {
            case percent -> {
                BigDecimal pct = value.min(BigDecimal.valueOf(100)).max(BigDecimal.ZERO);
                BigDecimal raw = subtotal.multiply(pct).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
                r.discountAmount = PricingService.round2(raw.min(subtotal));
            }
            case fixed -> r.discountAmount = PricingService.round2(value.min(subtotal));
            case free_shipping -> { r.discountAmount = BigDecimal.ZERO; r.freeShipping = true; }
        }
    }
}
