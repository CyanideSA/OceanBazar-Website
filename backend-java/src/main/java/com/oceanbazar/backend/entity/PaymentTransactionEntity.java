package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.*;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity @Table(name = "payment_transactions")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class PaymentTransactionEntity {
    @Id @Column(columnDefinition = "char(8)")
    private String id;

    @Column(name = "order_id", columnDefinition = "char(8)", nullable = false)
    private String orderId;

    @Column(name = "user_id", columnDefinition = "char(8)", nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentMethod method;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentTxStatus status;

    @Column(name = "provider_tx_id", length = 255)
    private String providerTxId;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(columnDefinition = "char(3)", nullable = false)
    private String currency;

    @Column(columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); if (status == null) status = PaymentTxStatus.pending; if (currency == null) currency = "BDT"; }
}
