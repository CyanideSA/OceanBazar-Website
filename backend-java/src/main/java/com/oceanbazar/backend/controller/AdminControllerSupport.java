package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.AdminUserEntity;
import com.oceanbazar.backend.entity.enums.AdminRole;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.security.AdminJwtSupport;
import com.oceanbazar.backend.security.AdminTokenService;
import io.jsonwebtoken.Claims;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

public final class AdminControllerSupport {
    private AdminControllerSupport() {}

    public static Claims requireAnyRole(
            AdminTokenService adminTokenService,
            AdminUserRepository adminUserRepository,
            String authorization,
            Set<String> allowedWireRoles
    ) {
        Claims claims = adminTokenService.parseAdmin(authorization);
        Integer adminId = AdminJwtSupport.parseAdminId(claims);
        if (adminId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin token");
        }
        AdminUserEntity admin = adminUserRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin token"));
        String wire = AdminRole.fromAny(admin.getRole()).wireRole();
        if (!Boolean.TRUE.equals(admin.getActive()) || !allowedWireRoles.contains(wire)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient permissions");
        }
        return claims;
    }
}
