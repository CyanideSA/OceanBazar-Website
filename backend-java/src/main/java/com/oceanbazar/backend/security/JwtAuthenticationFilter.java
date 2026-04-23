package com.oceanbazar.backend.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (uri != null && ("/ws".equals(uri) || uri.startsWith("/ws/"))) {
            filterChain.doFilter(request, response);
            return;
        }
        String token = extractCustomerJwt(request);
        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }
        try {
            Claims claims = jwtService.parse(token);
            String userId = claims.get("user_id", String.class);
            if (userId == null || userId.isBlank()) {
                filterChain.doFilter(request, response);
                return;
            }

            UserEntity user = userRepository.findById(userId).orElse(null);
            if (user == null || !user.canAccessCustomerApi()) {
                SecurityContextHolder.clearContext();
                response.setStatus(HttpStatus.FORBIDDEN.value());
                response.setContentType("application/json");
                response.getWriter().write("{\"detail\":\"Account inactive\"}");
                return;
            }

            // Only set authentication if it's a user JWT (not admin JWT).
            var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
            var authentication = new UsernamePasswordAuthenticationToken(userId, null, authorities);
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

            SecurityContextHolder.getContext().setAuthentication(authentication);
            filterChain.doFilter(request, response);
        } catch (Exception ex) {
            // Invalid token -> reject early.
            SecurityContextHolder.clearContext();
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"detail\":\"Invalid token\"}");
        }
    }

    /**
     * Authorization: Bearer … or {@code access_token} query on notification SSE (EventSource cannot set headers).
     */
    private static String extractCustomerJwt(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        String uri = request.getRequestURI();
        if ("GET".equalsIgnoreCase(request.getMethod())
                && uri != null
                && uri.contains("/notifications/stream")) {
            String q = request.getParameter("access_token");
            if (q != null && !q.isBlank()) {
                return q.trim();
            }
        }
        return null;
    }
}

