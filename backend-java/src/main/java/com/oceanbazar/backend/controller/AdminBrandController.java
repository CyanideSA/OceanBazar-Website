package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.BrandEntity;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.BrandRepository;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.utils.ShortId;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/brands")
@RequiredArgsConstructor
public class AdminBrandController {

    private final BrandRepository brandRepository;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL      = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");
    private static final Set<String> R_ADMIN_UP = Set.of("SUPER_ADMIN", "ADMIN");

    @GetMapping
    public List<BrandEntity> list(@RequestHeader("Authorization") String auth) {
        requireAnyRole(auth, R_ALL);
        return brandRepository.findAll(Sort.by(Sort.Direction.ASC, "sortOrder", "nameEn"));
    }

    @GetMapping("/{id}")
    public BrandEntity get(@RequestHeader("Authorization") String auth, @PathVariable String id) {
        requireAnyRole(auth, R_ALL);
        return brandRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Brand not found"));
    }

    @PostMapping
    public BrandEntity create(@RequestHeader("Authorization") String auth,
                               @RequestBody BrandEntity payload) {
        requireAnyRole(auth, R_ADMIN_UP);
        if (payload.getNameEn() == null || payload.getNameEn().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "nameEn is required");
        }
        String slug = toSlug(payload.getNameEn());
        if (brandRepository.existsBySlug(slug)) {
            slug = slug + "-" + ShortId.newId8().toLowerCase();
        }
        payload.setId(ShortId.newId8());
        if (payload.getNameBn() == null || payload.getNameBn().isBlank()) payload.setNameBn(payload.getNameEn());
        payload.setSlug(slug);
        if (payload.getSortOrder() == null) payload.setSortOrder(0);
        if (payload.getActive() == null) payload.setActive(true);
        return brandRepository.save(payload);
    }

    @PutMapping("/{id}")
    public BrandEntity update(@RequestHeader("Authorization") String auth,
                               @PathVariable String id,
                               @RequestBody BrandEntity payload) {
        requireAnyRole(auth, R_ADMIN_UP);
        BrandEntity existing = brandRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Brand not found"));
        if (payload.getNameEn() != null && !payload.getNameEn().isBlank()) existing.setNameEn(payload.getNameEn().trim());
        if (payload.getNameBn() != null && !payload.getNameBn().isBlank()) existing.setNameBn(payload.getNameBn().trim());
        if (payload.getLogoUrl() != null) existing.setLogoUrl(payload.getLogoUrl());
        if (payload.getSortOrder() != null) existing.setSortOrder(payload.getSortOrder());
        if (payload.getActive() != null) existing.setActive(payload.getActive());
        return brandRepository.save(existing);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@RequestHeader("Authorization") String auth, @PathVariable String id) {
        requireAnyRole(auth, R_ADMIN_UP);
        if (!brandRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Brand not found");
        }
        brandRepository.deleteById(id);
        return Map.of("success", true);
    }

    @GetMapping("/search")
    public List<BrandEntity> search(@RequestHeader("Authorization") String auth,
                                     @RequestParam(defaultValue = "") String q) {
        requireAnyRole(auth, R_ALL);
        if (q.isBlank()) return brandRepository.findAll(Sort.by("sortOrder", "nameEn"));
        return brandRepository.searchByName(q);
    }

    private String toSlug(String name) {
        return name.toLowerCase()
                .replaceAll("[^a-z0-9\\s]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
