package com.oceanbazar.backend.domain;

import com.oceanbazar.backend.entity.enums.AdminRole;

/**
 * Domain-level role taxonomy.
 *
 * Note: customer JWT uses {@code User.role}/{@code User.userType} strings today, while admin JWT uses {@link AdminRole}.
 * This enum provides a unified vocabulary for future refactors without changing persistence schema.
 */
public enum Role {
    SUPER_ADMIN,
    ADMIN,
    STAFF,
    RETAIL,
    WHOLESALE;

    public static Role fromAdminRole(AdminRole adminRole) {
        if (adminRole == null) return STAFF;
        return switch (adminRole) {
            case super_admin -> SUPER_ADMIN;
            case admin -> ADMIN;
            case staff -> STAFF;
        };
    }

    public static Role fromUserRoleString(String raw) {
        if (raw == null || raw.isBlank()) return RETAIL;
        String normalized = raw.trim().toUpperCase().replace(' ', '_').replace('-', '_');
        return switch (normalized) {
            case "WHOLESALE" -> WHOLESALE;
            case "RETAIL", "USER" -> RETAIL;
            default -> RETAIL;
        };
    }
}

