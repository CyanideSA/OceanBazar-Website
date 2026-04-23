package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.CouponEntity;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.service.CouponService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin/coupons")
@RequiredArgsConstructor
public class AdminCouponController {
    private final CouponService couponService;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");
    private static final Set<String> R_ADMIN_UP = Set.of("SUPER_ADMIN", "ADMIN");

    @GetMapping
    public List<CouponEntity> list(@RequestHeader("Authorization") String auth) {
        requireAnyRole(auth, R_ALL);
        return couponService.listAll();
    }

    @GetMapping("/active")
    public List<CouponEntity> active(@RequestHeader("Authorization") String auth) {
        requireAnyRole(auth, R_ALL);
        return couponService.listActive();
    }

    @PostMapping
    public CouponEntity create(@RequestHeader("Authorization") String auth, @RequestBody CouponEntity coupon) {
        requireAnyRole(auth, R_ADMIN_UP);
        return couponService.create(coupon);
    }

    @PutMapping("/{id}")
    public CouponEntity update(@RequestHeader("Authorization") String auth, @PathVariable String id, @RequestBody CouponEntity updates) {
        requireAnyRole(auth, R_ADMIN_UP);
        return couponService.update(id, updates);
    }

    @PostMapping("/validate")
    public Map<String, Object> validate(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> body) {
        requireAnyRole(auth, R_ALL);
        String code = (String) body.get("code");
        Double total = body.get("total") != null ? ((Number) body.get("total")).doubleValue() : 0.0;
        return couponService.validateCoupon(code, total, null);
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
