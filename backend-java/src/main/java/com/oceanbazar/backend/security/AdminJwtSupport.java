package com.oceanbazar.backend.security;

import io.jsonwebtoken.Claims;

public final class AdminJwtSupport {
    private AdminJwtSupport() {}

    public static Integer parseAdminId(Claims claims) {
        if (claims == null) {
            return null;
        }
        Object v = claims.get("admin_id");
        if (v == null) {
            return null;
        }
        if (v instanceof Integer i) {
            return i;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.valueOf(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Returns the admin_id as a String, or {@code null} when missing / unparseable. */
    public static String parseAdminIdStr(Claims claims) {
        Integer id = parseAdminId(claims);
        return id == null ? null : String.valueOf(id);
    }
}
