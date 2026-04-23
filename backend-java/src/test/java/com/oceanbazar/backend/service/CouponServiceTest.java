package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.CouponEntity;
import com.oceanbazar.backend.entity.enums.CouponType;
import com.oceanbazar.backend.repository.CouponRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CouponServiceTest {

    @Mock private CouponRepository couponRepository;

    @InjectMocks private CouponService couponService;

    private CouponEntity validCoupon;

    @BeforeEach
    void setUp() {
        validCoupon = new CouponEntity();
        validCoupon.setId(1);
        validCoupon.setCode("SAVE20");
        validCoupon.setType(CouponType.percent);
        validCoupon.setValue(BigDecimal.valueOf(20));
        validCoupon.setMinOrder(BigDecimal.valueOf(50));
        validCoupon.setActive(true);
        validCoupon.setUsedCount(0);
        validCoupon.setStartsAt(Instant.now().minusSeconds(3600));
    }

    @Test
    @DisplayName("validateCoupon returns valid with correct discount")
    void validateCoupon_valid() {
        when(couponRepository.findByCode("SAVE20")).thenReturn(Optional.of(validCoupon));

        Map<String, Object> result = couponService.validateCoupon("SAVE20", 100.0);

        assertTrue((Boolean) result.get("valid"));
        assertEquals(20.0, (Double) result.get("discount"), 0.01);
    }

    @Test
    @DisplayName("validateCoupon fails when order below minimum")
    void validateCoupon_belowMinimum() {
        when(couponRepository.findByCode("SAVE20")).thenReturn(Optional.of(validCoupon));

        Map<String, Object> result = couponService.validateCoupon("SAVE20", 30.0);

        assertFalse((Boolean) result.get("valid"));
    }

    @Test
    @DisplayName("validateCoupon applies fixed amount discount")
    void validateCoupon_fixedAmount() {
        validCoupon.setType(CouponType.fixed);
        validCoupon.setValue(BigDecimal.valueOf(10));
        when(couponRepository.findByCode("SAVE20")).thenReturn(Optional.of(validCoupon));

        Map<String, Object> result = couponService.validateCoupon("SAVE20", 100.0);

        assertTrue((Boolean) result.get("valid"));
        assertEquals(10.0, (Double) result.get("discount"), 0.01);
    }

    @Test
    @DisplayName("validateCoupon fails for expired coupon")
    void validateCoupon_expired() {
        validCoupon.setExpiresAt(Instant.now().minusSeconds(86400));
        when(couponRepository.findByCode("SAVE20")).thenReturn(Optional.of(validCoupon));

        Map<String, Object> result = couponService.validateCoupon("SAVE20", 100.0);

        assertFalse((Boolean) result.get("valid"));
    }
}
