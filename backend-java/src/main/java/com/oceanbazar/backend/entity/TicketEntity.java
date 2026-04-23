package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.*;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.List;

@Entity @Table(name = "tickets")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class TicketEntity {
    @Id @Column(columnDefinition = "char(8)")
    private String id;

    @Column(name = "user_id", columnDefinition = "char(8)", nullable = false)
    private String userId;

    @Column(name = "order_id", columnDefinition = "char(8)")
    private String orderId;

    @Column(name = "product_id", columnDefinition = "char(8)")
    private String productId;

    @Column(name = "payment_tx_id", columnDefinition = "char(8)")
    private String paymentTxId;

    @Column(length = 500, nullable = false)
    private String subject;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketPriority priority;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketCategory category;

    @Column(name = "assigned_to")
    private Integer assignedTo;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "ticketId", cascade = CascadeType.ALL)
    private List<TicketMessageEntity> messages;

    @PrePersist void prePersist() { Instant n = Instant.now(); if (createdAt == null) createdAt = n; if (updatedAt == null) updatedAt = n; if (status == null) status = TicketStatus.open; if (priority == null) priority = TicketPriority.medium; }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
