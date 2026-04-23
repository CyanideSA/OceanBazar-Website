package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.CatalogDtos.SearchResult;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.service.CatalogSearchService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Set;

@RestController
@RequestMapping("/api/admin/search")
@RequiredArgsConstructor
public class AdminCatalogSearchController {
    private final CatalogSearchService searchService;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");

    @GetMapping
    public SearchResult search(@RequestHeader("Authorization") String auth,
                                @RequestParam(defaultValue = "") String q) {
        requireAnyRole(auth, R_ALL);
        return searchService.search(q);
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
