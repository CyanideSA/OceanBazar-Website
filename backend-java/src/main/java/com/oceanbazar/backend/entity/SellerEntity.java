package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "sellers")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SellerEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", columnDefinition = "char(8)")
    private String userId;

    @Column(name = "business_name", nullable = false)
    private String businessName;

    @Column(name = "business_type")
    private String businessType;

    @Column(columnDefinition = "text")
    private String description;

    private String logo;
    private String banner;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "contact_phone")
    private String contactPhone;

    private String website;

    @Column(columnDefinition = "jsonb")
    private String address;

    @Column(name = "tax_id")
    private String taxId;

    @Column(name = "registration_number")
    private String registrationNumber;

    @Column(length = 20, nullable = false)
    private String status;

    @Column(name = "verification_status", length = 20, nullable = false)
    private String verificationStatus;

    @Column(name = "verification_documents", columnDefinition = "jsonb")
    private String verificationDocuments;

    @Column(name = "commission_rate", nullable = false)
    private Double commissionRate;

    @Column(name = "commission_type", length = 20, nullable = false)
    private String commissionType;

    @Column(name = "payout_account", columnDefinition = "jsonb")
    private String payoutAccount;

    @Column(name = "payout_schedule", length = 20, nullable = false)
    private String payoutSchedule;

    @Column(name = "total_sales", nullable = false)
    private Double totalSales;

    @Column(name = "total_orders", nullable = false)
    private Integer totalOrders;

    @Column(name = "average_rating", nullable = false)
    private Double averageRating;

    @Column(name = "total_reviews", nullable = false)
    private Integer totalReviews;

    @Column(columnDefinition = "jsonb")
    private String categories;

    @Column(columnDefinition = "jsonb")
    private String settings;

    @Column(name = "approved_by_admin_id")
    private String approvedByAdminId;

    @Column(name = "approved_at", columnDefinition = "timestamptz")
    private Instant approvedAt;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() {
        Instant n = Instant.now();
        if (createdAt == null) createdAt = n;
        if (updatedAt == null) updatedAt = n;
        if (status == null) status = "pending";
        if (verificationStatus == null) verificationStatus = "unverified";
        if (commissionRate == null) commissionRate = 0.0;
        if (commissionType == null) commissionType = "percentage";
        if (payoutSchedule == null) payoutSchedule = "monthly";
        if (totalSales == null) totalSales = 0.0;
        if (totalOrders == null) totalOrders = 0;
        if (averageRating == null) averageRating = 0.0;
        if (totalReviews == null) totalReviews = 0;
    }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
