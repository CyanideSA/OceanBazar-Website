package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.ProductBannerEntity;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.ProductBannerRepository;
import com.oceanbazar.backend.security.AdminTokenService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/banners")
@RequiredArgsConstructor
public class AdminBannerController {
    private final ProductBannerRepository bannerRepository;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");
    private static final Set<String> R_ADMIN_UP = Set.of("SUPER_ADMIN", "ADMIN");

    @GetMapping
    public List<ProductBannerEntity> list(@RequestHeader("Authorization") String auth,
                                           @RequestParam(required = false) String productId,
                                           @RequestParam(required = false) String categoryId) {
        requireAnyRole(auth, R_ALL);
        if (productId != null) return bannerRepository.findByProductIdOrderBySortOrderAsc(productId);
        if (categoryId != null) return bannerRepository.findByCategoryIdOrderBySortOrderAsc(categoryId);
        return bannerRepository.findByEnabledTrueOrderBySortOrderAsc();
    }

    @PostMapping
    public ProductBannerEntity create(@RequestHeader("Authorization") String auth,
                                       @RequestBody ProductBannerEntity banner) {
        requireAnyRole(auth, R_ADMIN_UP);
        return bannerRepository.save(banner);
    }

    @PutMapping("/{id}")
    public ProductBannerEntity update(@RequestHeader("Authorization") String auth,
                                       @PathVariable Integer id,
                                       @RequestBody ProductBannerEntity payload) {
        requireAnyRole(auth, R_ADMIN_UP);
        ProductBannerEntity existing = bannerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Banner not found"));
        if (payload.getImageUrl() != null) existing.setImageUrl(payload.getImageUrl());
        if (payload.getLinkUrl() != null) existing.setLinkUrl(payload.getLinkUrl());
        if (payload.getTitle() != null) existing.setTitle(payload.getTitle());
        if (payload.getPlacement() != null) existing.setPlacement(payload.getPlacement());
        if (payload.getSortOrder() != null) existing.setSortOrder(payload.getSortOrder());
        if (payload.getRotationMs() != null) existing.setRotationMs(payload.getRotationMs());
        if (payload.getEnabled() != null) existing.setEnabled(payload.getEnabled());
        if (payload.getStartsAt() != null) existing.setStartsAt(payload.getStartsAt());
        if (payload.getEndsAt() != null) existing.setEndsAt(payload.getEndsAt());
        return bannerRepository.save(existing);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@RequestHeader("Authorization") String auth, @PathVariable Integer id) {
        requireAnyRole(auth, R_ADMIN_UP);
        bannerRepository.deleteById(id);
        return Map.of("success", true);
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
