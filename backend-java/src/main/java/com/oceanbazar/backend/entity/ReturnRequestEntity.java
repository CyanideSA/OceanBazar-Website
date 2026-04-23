package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "return_requests")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ReturnRequestEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "order_id", nullable = false)
    private String orderId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "seller_id")
    private String sellerId;

    @Column(columnDefinition = "jsonb")
    private String items;

    @Column(columnDefinition = "text")
    private String reason;

    @Column(name = "reason_category", length = 50)
    private String reasonCategory;

    @Column(columnDefinition = "text")
    private String description;

    @Column(columnDefinition = "jsonb")
    private String images;

    @Column(length = 20, nullable = false)
    private String status;

    @Column(name = "refund_method", length = 30)
    private String refundMethod;

    @Column(name = "refund_amount", nullable = false)
    private Double refundAmount;

    @Column(name = "tracking_number")
    private String trackingNumber;

    @Column(name = "shipping_carrier")
    private String shippingCarrier;

    @Column(name = "assigned_to_admin_id")
    private String assignedToAdminId;

    @Column(name = "dispute_id")
    private String disputeId;

    @Column(name = "admin_note", columnDefinition = "text")
    private String adminNote;

    @Column(columnDefinition = "jsonb")
    private String timeline;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() { Instant n = Instant.now(); if (createdAt == null) createdAt = n; if (updatedAt == null) updatedAt = n; if (status == null) status = "pending"; if (refundAmount == null) refundAmount = 0.0; }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
