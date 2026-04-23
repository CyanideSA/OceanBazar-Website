package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.service.CouponService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/coupons")
@RequiredArgsConstructor
public class CouponController {
    private final CouponService couponService;
    private final AuthTokenService authTokenService;

    @PostMapping("/validate")
    public Map<String, Object> validate(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> body) {
        String code = (String) body.get("code");
        Double total = body.get("total") != null ? ((Number) body.get("total")).doubleValue() : 0.0;
        String userId = authTokenService.tryGetUserIdFromAuthorization(authorization);
        return couponService.validateCoupon(code, total, userId);
    }
}
