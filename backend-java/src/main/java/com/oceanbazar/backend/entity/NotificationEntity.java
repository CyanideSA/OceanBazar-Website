package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "notifications")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class NotificationEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text", nullable = false)
    private String message;

    private String image;

    @Column(length = 50, nullable = false)
    private String audience;

    @Column(name = "user_id", columnDefinition = "char(8)")
    private String userId;

    @Column(length = 50)
    private String kind;

    @Column(name = "entity_id")
    private String entityId;

    @Column(name = "read_status", nullable = false)
    private Boolean readStatus;

    @Column(name = "created_by_admin_id")
    private String createdByAdminId;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); if (audience == null) audience = "all"; if (readStatus == null) readStatus = false; }
}
