package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.OtpType;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "otp_codes")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class OtpCodeEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(length = 255, nullable = false)
    private String target;

    @Column(columnDefinition = "char(6)", nullable = false)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OtpType type;

    @Column(name = "expires_at", columnDefinition = "timestamptz", nullable = false)
    private Instant expiresAt;

    @Column(nullable = false)
    private Boolean used;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); if (used == null) used = false; }
}
