package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "analytics_events", indexes = @Index(columnList = "event_type, created_at"))
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class AnalyticsEventEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "event_type", length = 100, nullable = false)
    private String eventType;

    @Column(name = "user_id", columnDefinition = "char(8)")
    private String userId;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Column(columnDefinition = "jsonb")
    private String payload;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}
