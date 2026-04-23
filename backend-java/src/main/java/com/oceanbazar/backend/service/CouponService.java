package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.CouponEntity;
import com.oceanbazar.backend.repository.CouponRepository;
import com.oceanbazar.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class CouponService {
    private final CouponRepository couponRepository;
    private final OrderRepository orderRepository;

    public List<CouponEntity> listAll() {
        return couponRepository.findAll();
    }

    public List<CouponEntity> listActive() {
        return couponRepository.findByActiveTrue();
    }

    public CouponEntity getByCode(String code) {
        return couponRepository.findByCode(code.toUpperCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Coupon not found"));
    }

    public CouponEntity create(CouponEntity coupon) {
        coupon.setCode(coupon.getCode().toUpperCase());
        if (couponRepository.existsByCode(coupon.getCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Coupon code already exists");
        }
        return couponRepository.save(coupon);
    }

    public CouponEntity update(String id, CouponEntity updates) {
        int couponId;
        try {
            couponId = Integer.parseInt(id.trim());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid coupon id");
        }
        CouponEntity coupon = couponRepository.findById(couponId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Coupon not found"));
        if (updates.getCode() != null) coupon.setCode(updates.getCode());
        if (updates.getType() != null) coupon.setType(updates.getType());
        if (updates.getValue() != null) coupon.setValue(updates.getValue());
        if (updates.getMinOrder() != null) coupon.setMinOrder(updates.getMinOrder());
        if (updates.getMaxUses() != null) coupon.setMaxUses(updates.getMaxUses());
        if (updates.getActive() != null) coupon.setActive(updates.getActive());
        if (updates.getStartsAt() != null) coupon.setStartsAt(updates.getStartsAt());
        if (updates.getExpiresAt() != null) coupon.setExpiresAt(updates.getExpiresAt());
        return couponRepository.save(coupon);
    }

    public Map<String, Object> validateCoupon(String code, Double orderTotal) {
        return validateCoupon(code, orderTotal, null);
    }

    public Map<String, Object> validateCoupon(String code, Double orderTotal, String userId) {
        CouponEntity coupon = getByCode(code);
        Map<String, Object> result = new HashMap<>();
        result.put("valid", false);
        result.put("coupon", coupon);

        if (!isValid(coupon)) {
            result.put("message", "Coupon is expired or inactive");
            return result;
        }
        double total = orderTotal == null ? 0.0 : orderTotal;
        double minOrder = coupon.getMinOrder() == null ? 0.0 : coupon.getMinOrder().doubleValue();
        if (total < minOrder) {
            result.put("message", "Minimum order amount is " + minOrder);
            return result;
        }

        Integer maxUses = coupon.getMaxUses();
        if (maxUses != null && maxUses > 0 && userId != null && !userId.isBlank() && coupon.getId() != null) {
            long priorUses = orderRepository.countByUserIdAndCouponId(userId, coupon.getId());
            if (priorUses >= maxUses) {
                result.put("message", "You have already used this coupon the maximum number of times");
                return result;
            }
        }

        double discount = 0;
        String type = coupon.getType() != null ? coupon.getType().name() : "";
        double value = coupon.getValue() != null ? coupon.getValue().doubleValue() : 0.0;
        if ("percent".equals(type)) {
            discount = total * (value / 100.0);
        } else if ("fixed".equals(type)) {
            discount = value;
        }

        result.put("valid", true);
        result.put("discount", Math.round(discount * 100.0) / 100.0);
        return result;
    }

    public void incrementUsage(Integer couponId) {
        if (couponId == null) {
            return;
        }
        couponRepository.findById(couponId).ifPresent(c -> {
            c.setUsedCount((c.getUsedCount() == null ? 0 : c.getUsedCount()) + 1);
            couponRepository.save(c);
        });
    }

    private static boolean isValid(CouponEntity coupon) {
        if (coupon.getActive() == null || !coupon.getActive()) return false;
        Instant now = Instant.now();
        if (coupon.getStartsAt() != null && now.isBefore(coupon.getStartsAt())) return false;
        if (coupon.getExpiresAt() != null && now.isAfter(coupon.getExpiresAt())) return false;
        if (coupon.getMaxUses() != null && coupon.getUsedCount() != null
                && coupon.getUsedCount() >= coupon.getMaxUses()) return false;
        return true;
    }
}
