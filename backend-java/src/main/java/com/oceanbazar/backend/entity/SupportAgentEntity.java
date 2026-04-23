package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "support_agents")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SupportAgentEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "agent_id", unique = true, nullable = false)
    private String agentId;

    @Column(nullable = false)
    private String name;

    private String email;

    @Column(length = 30, nullable = false)
    private String role;

    @Column(nullable = false)
    private Boolean active;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); if (role == null) role = "SUPPORT_AGENT"; if (active == null) active = true; }
}
