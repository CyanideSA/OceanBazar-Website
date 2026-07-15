package com.oceanbazar.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Returns 503 for all traffic when MAINTENANCE_MODE is enabled.
 * Bypass: query ?bypass=TOKEN, header x-maintenance-bypass, or cookie ob_maint_bypass.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class MaintenanceModeFilter extends OncePerRequestFilter {

    private static final Set<String> TRUTHY = Set.of("1", "true", "yes", "on");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (!isMaintenanceEnabled()) {
            filterChain.doFilter(request, response);
            return;
        }
        if (bypassOk(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String retryAfter = System.getenv().getOrDefault("MAINTENANCE_RETRY_AFTER", "3600");
        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setHeader("Retry-After", retryAfter);
        response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
        response.setHeader("X-Maintenance-Mode", "1");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(
                "{\"error\":\"Service Unavailable\",\"maintenance\":true,"
                        + "\"message\":\"OceanBazar is temporarily unavailable while we prepare for launch.\"}"
        );
    }

    private static boolean isMaintenanceEnabled() {
        String v = System.getenv("MAINTENANCE_MODE");
        if (v == null) return false;
        return TRUTHY.contains(v.trim().toLowerCase());
    }

    private static boolean bypassOk(HttpServletRequest request) {
        String token = System.getenv("MAINTENANCE_BYPASS_TOKEN");
        if (token == null || token.isBlank()) return false;
        String q = request.getParameter("bypass");
        if (token.equals(q)) return true;
        String h = request.getHeader("x-maintenance-bypass");
        if (token.equals(h)) return true;
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if ("ob_maint_bypass".equals(c.getName()) && token.equals(c.getValue())) {
                    return true;
                }
            }
        }
        return false;
    }
}
