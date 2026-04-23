package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.SocialProvider;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "social_accounts", uniqueConstraints = @UniqueConstraint(columnNames = {"provider", "provider_id"}))
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SocialAccountEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id", columnDefinition = "char(8)", nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SocialProvider provider;

    @Column(name = "provider_id", length = 255, nullable = false)
    private String providerId;

    @Column(name = "access_token")
    private String accessToken;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}
