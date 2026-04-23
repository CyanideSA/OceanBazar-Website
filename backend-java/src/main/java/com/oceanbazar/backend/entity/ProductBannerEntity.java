package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "product_banners")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductBannerEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "product_id", columnDefinition = "char(8)")
    private String productId;

    @Column(name = "category_id", columnDefinition = "char(8)")
    private String categoryId;

    @Column(name = "image_url", nullable = false, columnDefinition = "text")
    private String imageUrl;

    @Column(name = "link_url", columnDefinition = "text")
    private String linkUrl;

    @Column(length = 255)
    private String title;

    @Column(length = 20, nullable = false)
    private String placement;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "rotation_ms", nullable = false)
    private Integer rotationMs;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(name = "starts_at", columnDefinition = "timestamptz")
    private Instant startsAt;

    @Column(name = "ends_at", columnDefinition = "timestamptz")
    private Instant endsAt;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (placement == null) placement = "ALL";
        if (sortOrder == null) sortOrder = 0;
        if (rotationMs == null) rotationMs = 6000;
        if (enabled == null) enabled = true;
    }
}
