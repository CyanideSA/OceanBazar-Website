package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "wholesale_applications")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class WholesaleApplicationEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "business_name", nullable = false)
    private String businessName;

    @Column(name = "business_type")
    private String businessType;

    @Column(name = "tax_id")
    private String taxId;

    @Column(name = "contact_person")
    private String contactPerson;

    private String email;
    private String phone;

    @Column(columnDefinition = "text")
    private String address;

    @Column(name = "business_description", columnDefinition = "text")
    private String businessDescription;

    @Column(name = "expected_volume")
    private String expectedVolume;

    @Column(length = 20, nullable = false)
    private String status;

    @Column(name = "admin_notes", columnDefinition = "text")
    private String adminNotes;

    @Column(name = "reviewed_by_admin_id")
    private String reviewedByAdminId;

    @Column(name = "reviewed_at", columnDefinition = "timestamptz")
    private Instant reviewedAt;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() { Instant n = Instant.now(); if (createdAt == null) createdAt = n; if (updatedAt == null) updatedAt = n; if (status == null) status = "pending"; }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
