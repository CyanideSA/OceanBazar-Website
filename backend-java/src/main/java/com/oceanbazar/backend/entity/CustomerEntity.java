package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "customers")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class CustomerEntity {
    @Id @Column(name = "user_id", columnDefinition = "char(8)")
    private String userId;

    @Column(name = "company_name", length = 255)
    private String companyName;

    @Column(name = "tax_id", length = 100)
    private String taxId;

    @Column(length = 64)
    private String segment;

    private String notes;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() { Instant n = Instant.now(); if (createdAt == null) createdAt = n; if (updatedAt == null) updatedAt = n; }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
