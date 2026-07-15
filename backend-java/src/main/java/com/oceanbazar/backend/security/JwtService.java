package com.oceanbazar.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {
    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.access-secret:}")
    private String jwtAccessSecret;

    private SecretKey keyFor(String secret) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        // HS256 requires at least 32 bytes.
        if (keyBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, keyBytes.length);
            keyBytes = padded;
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    private SecretKey coreKey() {
        return keyFor(jwtSecret);
    }

    private SecretKey bffKey() {
        if (jwtAccessSecret == null || jwtAccessSecret.isBlank()) {
            return null;
        }
        return keyFor(jwtAccessSecret);
    }

    public String createToken(String userId, String email) {
        Instant now = Instant.now();
        return Jwts.builder()
                .claims(Map.of("user_id", userId, "email", email))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(30, ChronoUnit.DAYS)))
                .signWith(coreKey())
                .compact();
    }

    public Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(coreKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception coreEx) {
            SecretKey bff = bffKey();
            if (bff == null) {
                throw coreEx;
            }
            return Jwts.parser()
                    .verifyWith(bff)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        }
    }

    public static String userIdFromClaims(Claims claims) {
        if (claims == null) return null;
        String userId = claims.get("user_id", String.class);
        if (userId == null || userId.isBlank()) {
            userId = claims.get("userId", String.class);
        }
        return userId;
    }
}
