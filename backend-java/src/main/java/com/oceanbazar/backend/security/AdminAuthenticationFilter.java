package com.oceanbazar.backend.security;

import com.oceanbazar.backend.entity.enums.AdminRole;
import com.oceanbazar.backend.entity.AdminUserEntity;
import com.oceanbazar.backend.repository.AdminUserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class AdminAuthenticationFilter extends OncePerRequestFilter {
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    public AdminAuthenticationFilter(AdminTokenService adminTokenService, AdminUserRepository adminUserRepository) {
        this.adminTokenService = adminTokenService;
        this.adminUserRepository = adminUserRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/admin/") || "/api/admin/auth/login".equals(path)) {
            filterChain.doFilter(request, response);
            return;
        }
        String authorization = request.getHeader("Authorization");
        // Also check "token" query parameter for live endpoints if Authorization header is missing
        if ((authorization == null || !authorization.startsWith("Bearer ")) && path.startsWith("/api/admin/live/")) {
            String qToken = request.getParameter("token");
            if (qToken != null && !qToken.isBlank()) {
                authorization = "Bearer " + qToken.trim();
            }
        }

        if (authorization == null || !authorization.startsWith("Bearer ")) {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"detail\":\"Missing admin token\"}");
            return;
        }
        try {
            Claims claims = adminTokenService.parseAdmin(authorization);
            Integer adminId = AdminJwtSupport.parseAdminId(claims);
            AdminUserEntity admin = adminId == null ? null : adminUserRepository.findById(adminId).orElse(null);
            if (admin == null || !Boolean.TRUE.equals(admin.getActive())) {
                response.setStatus(HttpStatus.UNAUTHORIZED.value());
                response.setContentType("application/json");
                response.getWriter().write("{\"detail\":\"Invalid admin token\"}");
                return;
            }
            AdminRole ar = AdminRole.fromAny(admin.getRole());
            String wire = ar.wireRole();
            var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + wire));
            var authentication = new UsernamePasswordAuthenticationToken(String.valueOf(adminId), null, authorities);
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
            filterChain.doFilter(request, response);
        } catch (Exception ex) {
            SecurityContextHolder.clearContext();
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"detail\":\"Invalid admin token\"}");
        }
    }

}
