package com.oceanbazar.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Echoes {@code X-Request-Id} from the Node BFF (or generates one) and binds it to {@link MDC} for log correlation.
 * Registered only via {@link com.oceanbazar.backend.config.SecurityConfig} (not a {@code @Component}) to avoid
 * double-registration as both a servlet filter and a security filter.
 */
public class RequestIdCorrelationFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Request-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String id = request.getHeader(HEADER);
        if (id == null || id.isBlank()) {
            id = UUID.randomUUID().toString();
        }
        response.setHeader(HEADER, id);
        MDC.put("requestId", id);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("requestId");
        }
    }
}
