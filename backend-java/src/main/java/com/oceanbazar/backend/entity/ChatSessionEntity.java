package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "chat_sessions")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ChatSessionEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(columnDefinition = "jsonb")
    private String messages;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(name = "agent_engaged", nullable = false)
    private Boolean agentEngaged;

    @Column(name = "closed_by_agent_at", columnDefinition = "timestamptz")
    private Instant closedByAgentAt;

    @Column(name = "last_message_at", columnDefinition = "timestamptz", nullable = false)
    private Instant lastMessageAt;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    /** Populated for admin API only; not stored. */
    @Transient
    private String customerName;

    /** Populated for admin API only; not stored. */
    @Transient
    private String customerType;

    @PrePersist void prePersist() { Instant n = Instant.now(); if (createdAt == null) createdAt = n; if (lastMessageAt == null) lastMessageAt = n; if (isActive == null) isActive = true; if (agentEngaged == null) agentEngaged = false; }
}
