package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.ShipmentStatus;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity @Table(name = "shipments")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ShipmentEntity {
    @Id @Column(columnDefinition = "char(8)")
    private String id;

    @Column(name = "order_id", columnDefinition = "char(8)", nullable = false)
    private String orderId;

    @Column(length = 100, nullable = false)
    private String carrier;

    @Column(name = "tracking_number", columnDefinition = "char(16)", nullable = false)
    private String trackingNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ShipmentStatus status;

    @Column(name = "estimated_delivery")
    private LocalDate estimatedDelivery;

    @Column(columnDefinition = "jsonb")
    private String events;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() { Instant n = Instant.now(); if (createdAt == null) createdAt = n; if (updatedAt == null) updatedAt = n; if (status == null) status = ShipmentStatus.pending; }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
