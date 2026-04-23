package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "domain_events")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class DomainEventEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "aggregate_type", length = 50, nullable = false)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false)
    private String aggregateId;

    @Column(name = "event_type", length = 100, nullable = false)
    private String eventType;

    @Column(columnDefinition = "jsonb")
    private String payload;

    @Column(length = 20, nullable = false)
    private String status;

    @Column(name = "retry_count", nullable = false)
    private Integer retryCount;

    @Column(name = "processed_at", columnDefinition = "timestamptz")
    private Instant processedAt;

    @Column(name = "processing_error", columnDefinition = "text")
    private String processingError;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); if (status == null) status = "pending"; if (retryCount == null) retryCount = 0; }

    public static DomainEventEntity create(String aggregateType, String aggregateId, String eventType, String payload) {
        DomainEventEntity e = new DomainEventEntity();
        e.setId(UUID.randomUUID().toString());
        e.setAggregateType(aggregateType);
        e.setAggregateId(aggregateId);
        e.setEventType(eventType);
        e.setPayload(payload);
        return e;
    }
}
