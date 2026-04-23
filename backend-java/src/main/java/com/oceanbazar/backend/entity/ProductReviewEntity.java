package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.ReviewStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

@Entity @Table(name = "product_reviews", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "product_id"}))
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductReviewEntity {
    @Id @Column(columnDefinition = "char(8)")
    private String id;

    @Column(name = "user_id", columnDefinition = "char(8)", nullable = false)
    private String userId;

    @Column(name = "product_id", columnDefinition = "char(8)", nullable = false)
    private String productId;

    @Column(name = "order_id", columnDefinition = "char(8)")
    private String orderId;

    @Column(nullable = false)
    private Integer rating;

    @Column(length = 255)
    private String title;

    @Column(columnDefinition = "text")
    private String body;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, columnDefinition = "varchar")
    private ReviewStatus status;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() { Instant n = Instant.now(); if (createdAt == null) createdAt = n; if (updatedAt == null) updatedAt = n; if (status == null) status = ReviewStatus.pending; }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
