package com.oceanbazar.backend.entity.enums;

import java.util.Locale;

public enum AdminRole {
    super_admin, admin, staff;

    public static AdminRole fromAny(Object role) {
        if (role == null) {
            return staff;
        }
        if (role instanceof AdminRole ar) {
            return ar;
        }
        String s = role.toString().trim().toUpperCase(Locale.ROOT).replace('-', '_');
        return switch (s) {
            case "SUPER_ADMIN", "SUPERADMIN" -> super_admin;
            case "ADMIN" -> admin;
            case "STAFF" -> staff;
            default -> {
                try {
                    yield AdminRole.valueOf(s.toLowerCase(Locale.ROOT));
                } catch (IllegalArgumentException ex) {
                    yield staff;
                }
            }
        };
    }

    /** Legacy wire form used in JWT permission checks (e.g. {@code SUPER_ADMIN}). */
    public String wireRole() {
        return switch (this) {
            case super_admin -> "SUPER_ADMIN";
            case admin -> "ADMIN";
            case staff -> "STAFF";
        };
    }

    public String getDisplayLabel() {
        return switch (this) {
            case super_admin -> "Super Admin";
            case admin -> "Admin";
            case staff -> "Staff";
        };
    }
}
