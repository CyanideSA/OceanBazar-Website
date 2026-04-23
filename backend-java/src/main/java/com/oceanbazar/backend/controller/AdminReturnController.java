package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.ReturnRequestEntity;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.security.AdminJwtSupport;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.service.ReturnService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/api/admin/returns")
@RequiredArgsConstructor
public class AdminReturnController {
    private final ReturnService returnService;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");
    private static final Set<String> R_ADMIN_UP = Set.of("SUPER_ADMIN", "ADMIN");

    @GetMapping
    public List<ReturnRequestEntity> list(@RequestHeader("Authorization") String auth, @RequestParam(required = false) String status) {
        requireAnyRole(auth, R_ALL);
        return status != null ? returnService.listByStatus(status) : returnService.listAll();
    }

    @GetMapping("/{id}")
    public ReturnRequestEntity getById(@RequestHeader("Authorization") String auth, @PathVariable String id) {
        requireAnyRole(auth, R_ALL);
        return returnService.getById(id);
    }

    @PatchMapping("/{id}/status")
    public ReturnRequestEntity updateStatus(@RequestHeader("Authorization") String auth, @PathVariable String id, @RequestBody Map<String, String> body) {
        Claims claims = requireAnyRole(auth, R_ALL);
        return returnService.updateStatus(id, body.get("status"), body.get("note"),
                AdminJwtSupport.parseAdminIdStr(claims), "admin");
    }

    @PostMapping("/{id}/refund")
    public ReturnRequestEntity processRefund(@RequestHeader("Authorization") String auth, @PathVariable String id, @RequestBody Map<String, Object> body) {
        requireAnyRole(auth, R_ADMIN_UP);
        Double amount = body.get("amount") != null ? ((Number) body.get("amount")).doubleValue() : 0.0;
        String method = (String) body.getOrDefault("method", "original_payment");
        return returnService.processRefund(id, amount, method);
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
