package com.oceanbazar.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Enforces admin role rules after {@link AdminAuthenticationFilter} has set the security context.
 * Staff: no Global Settings; cannot create/update/delete admin members (view-only for team list/detail).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
public class AdminEndpointAccessFilter extends OncePerRequestFilter {

    private static final Set<String> ADMIN_OR_SUPER = Set.of("SUPER_ADMIN", "ADMIN");
    private static final Set<String> SUPER_ONLY = Set.of("SUPER_ADMIN");

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (!uri.startsWith("/api/admin/")) {
            filterChain.doFilter(request, response);
            return;
        }
        if ("/api/admin/auth/login".equals(uri)) {
            filterChain.doFilter(request, response);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            filterChain.doFilter(request, response);
            return;
        }

        Set<String> roles = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(a -> a.startsWith("ROLE_") ? a.substring("ROLE_".length()) : a)
                .collect(Collectors.toCollection(HashSet::new));

        String method = request.getMethod();

        if (isGlobalSettingsPath(uri) && ("GET".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method))) {
            if (!hasAnyRole(roles, ADMIN_OR_SUPER)) {
                deny(response);
                return;
            }
        }

        if ("POST".equalsIgnoreCase(method) && "/api/admin/members".equals(uri)) {
            if (!hasAnyRole(roles, ADMIN_OR_SUPER)) {
                deny(response);
                return;
            }
        }

        if (isMemberByIdPath(uri)) {
            if ("PUT".equalsIgnoreCase(method) && !hasAnyRole(roles, ADMIN_OR_SUPER)) {
                deny(response);
                return;
            }
            if ("DELETE".equalsIgnoreCase(method) && !hasAnyRole(roles, SUPER_ONLY)) {
                deny(response);
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private static boolean isGlobalSettingsPath(String uri) {
        return "/api/admin/global-settings".equals(uri) || "/api/admin/site-settings".equals(uri);
    }

    /**
     * {@code /api/admin/members/{id}} only (single path segment after members).
     */
    private static boolean isMemberByIdPath(String uri) {
        if (!uri.startsWith("/api/admin/members/")) {
            return false;
        }
        String rest = uri.substring("/api/admin/members/".length());
        return !rest.isEmpty() && !rest.contains("/");
    }

    private static boolean hasAnyRole(Set<String> actual, Set<String> allowed) {
        for (String r : allowed) {
            if (actual.contains(r)) {
                return true;
            }
        }
        return false;
    }

    private static void deny(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write("{\"detail\":\"Insufficient permissions for this action\"}");
    }
}
