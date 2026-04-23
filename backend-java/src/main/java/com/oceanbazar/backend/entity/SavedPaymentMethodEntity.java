package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "saved_payment_methods")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SavedPaymentMethodEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(length = 20, nullable = false)
    private String type;

    private String nickname;

    @Column(name = "card_brand")
    private String cardBrand;

    @Column(length = 4)
    private String last4;

    @Column(name = "expiry_month")
    private Integer expiryMonth;

    @Column(name = "expiry_year")
    private Integer expiryYear;

    @Column(name = "wallet_provider")
    private String walletProvider;

    @Column(name = "wallet_last4", length = 4)
    private String walletLast4;

    @Column(name = "bank_name")
    private String bankName;

    @Column(name = "bank_account_last4", length = 4)
    private String bankAccountLast4;

    @Column(name = "default_method")
    private Boolean defaultMethod;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() { Instant n = Instant.now(); if (createdAt == null) createdAt = n; if (updatedAt == null) updatedAt = n; }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }

    public boolean isDefaultMethod() { return Boolean.TRUE.equals(defaultMethod); }
}
