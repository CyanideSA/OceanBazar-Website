package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.AdminUserEntity;
import com.oceanbazar.backend.entity.enums.AdminRole;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.service.AnalyticsService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/api/admin/analytics")
@RequiredArgsConstructor
public class AdminAnalyticsController {
    private final AnalyticsService analyticsService;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@RequestHeader("Authorization") String auth) {
        requireAnyRole(auth, R_ALL);
        return analyticsService.getDashboardMetrics();
    }

    @GetMapping("/sales")
    public Map<String, Object> sales(
            @RequestHeader("Authorization") String auth,
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "day") String grain) {
        requireAnyRole(auth, R_ALL);
        return analyticsService.getSalesAnalytics(days, grain);
    }

    @GetMapping("/customer-growth")
    public Map<String, Object> customerGrowth(
            @RequestHeader("Authorization") String auth,
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "day") String grain) {
        requireAnyRole(auth, R_ALL);
        return analyticsService.getCustomerGrowth(days, grain);
    }

    @GetMapping("/top-products")
    public Map<String, Object> topProducts(@RequestHeader("Authorization") String auth, @RequestParam(defaultValue = "10") int limit) {
        requireAnyRole(auth, R_ALL);
        return analyticsService.getTopProducts(limit);
    }

    @GetMapping("/customers")
    public Map<String, Object> customers(@RequestHeader("Authorization") String auth) {
        requireAnyRole(auth, R_ALL);
        return analyticsService.getCustomerAnalytics();
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
