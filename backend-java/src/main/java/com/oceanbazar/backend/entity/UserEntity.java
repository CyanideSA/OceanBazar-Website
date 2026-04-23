package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.*;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity @Table(name = "users")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class UserEntity {
    @Id @Column(columnDefinition = "char(8)")
    private String id;

    @Column(length = 255, nullable = false)
    private String name;

    @Column(length = 255, unique = true)
    private String email;

    @Column(length = 20, unique = true)
    private String phone;

    @Column(name = "password_hash")
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "user_type", nullable = false)
    private UserType userType;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_status", nullable = false)
    private AccountStatus accountStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferred_lang", nullable = false)
    private Lang preferredLang;

    @Column(name = "email_verified", nullable = false)
    private Boolean emailVerified;

    @Column(name = "profile_image")
    private String profileImage;

    @Column(name = "lifetime_spend", precision = 12, scale = 2, nullable = false)
    private BigDecimal lifetimeSpend;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (userType == null) userType = UserType.retail;
        if (accountStatus == null) accountStatus = AccountStatus.active;
        if (preferredLang == null) preferredLang = Lang.en;
        if (lifetimeSpend == null) lifetimeSpend = BigDecimal.ZERO;
        if (emailVerified == null) emailVerified = false;
    }

    @PreUpdate
    void preUpdate() { updatedAt = Instant.now(); }

    /** Storefront + customer API access (JWT filter). */
    public boolean canAccessCustomerApi() {
        return accountStatus == null || accountStatus == AccountStatus.active;
    }
}
