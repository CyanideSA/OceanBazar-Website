package com.oceanbazar.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {
    private static class WindowCounter {
        long windowStartMs;
        int count;
    }

    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();
    private final int maxAttempts;
    private final long windowMs;

    public LoginRateLimitFilter(
            @Value("${security.rate-limit.login.max-attempts:20}") int maxAttempts,
            @Value("${security.rate-limit.login.window-seconds:60}") long windowSeconds
    ) {
        this.maxAttempts = Math.max(1, maxAttempts);
        this.windowMs = Math.max(1, windowSeconds) * 1000L;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) return true;
        String path = request.getRequestURI();
        return !"/api/auth/login".equals(path) && !"/api/admin/auth/login".equals(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String source = request.getRemoteAddr();
        String key = request.getRequestURI() + "|" + (source == null ? "unknown" : source);
        long now = System.currentTimeMillis();

        WindowCounter wc = counters.computeIfAbsent(key, k -> {
            WindowCounter w = new WindowCounter();
            w.windowStartMs = now;
            w.count = 0;
            return w;
        });

        synchronized (wc) {
            if (now - wc.windowStartMs >= windowMs) {
                wc.windowStartMs = now;
                wc.count = 0;
            }
            wc.count += 1;
            if (wc.count > maxAttempts) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json");
                response.getWriter().write("{\"detail\":\"Too many login attempts. Please try again shortly.\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}

