package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.ProductReviewEntity;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.security.AdminJwtSupport;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.service.ReviewService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin/reviews")
@RequiredArgsConstructor
public class AdminReviewController {
    private final ReviewService reviewService;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");

    @GetMapping("/pending")
    public List<ProductReviewEntity> pending(@RequestHeader("Authorization") String auth) {
        requireAnyRole(auth, R_ALL);
        return reviewService.getPendingReviews();
    }

    @GetMapping("/product/{productId}")
    public List<ProductReviewEntity> byProduct(@RequestHeader("Authorization") String auth, @PathVariable String productId) {
        requireAnyRole(auth, R_ALL);
        return reviewService.getProductReviewsForAdmin(productId);
    }

    @PatchMapping("/{id}/moderate")
    public ProductReviewEntity moderate(@RequestHeader("Authorization") String auth, @PathVariable String id, @RequestBody Map<String, String> body) {
        Claims claims = requireAnyRole(auth, R_ALL);
        String status = body.getOrDefault("status", "approved");
        String note = body.get("note");
        Integer aid = AdminJwtSupport.parseAdminId(claims);
        return reviewService.moderateReview(id, status, note, aid == null ? null : String.valueOf(aid));
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
