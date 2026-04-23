package com.oceanbazar.backend.security;

import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthTokenService {
    private final JwtService jwtService;

    public String getUserIdFromAuthorization(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication credentials");
        }
        return getUserIdFromJwtToken(authorization.substring(7));
    }

    /**
     * For optional-auth endpoints (e.g. coupon preview): returns {@code null} if there is no valid Bearer token.
     */
    public String tryGetUserIdFromAuthorization(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        try {
            return getUserIdFromJwtToken(authorization.substring(7));
        } catch (Exception ex) {
            return null;
        }
    }

    /** Raw JWT (no Bearer prefix), e.g. {@code access_token} query for SSE. */
    public String getUserIdFromJwtToken(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication credentials");
        }
        try {
            Claims claims = jwtService.parse(token.trim());
            String userId = claims.get("user_id", String.class);
            if (userId == null || userId.isBlank()) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication credentials");
            }
            return userId;
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication credentials");
        }
    }
}
