package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "business_inquiries")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class BusinessInquiryEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "business_name")
    private String businessName;

    private String email;
    private String phone;

    @Column(name = "business_type")
    private String businessType;

    private String country;

    @Column(columnDefinition = "text")
    private String message;

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
