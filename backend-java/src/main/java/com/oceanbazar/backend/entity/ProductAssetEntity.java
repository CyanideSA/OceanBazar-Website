package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.AssetType;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "product_assets")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductAssetEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "product_id", columnDefinition = "char(8)", nullable = false)
    private String productId;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_type", length = 10, nullable = false)
    private AssetType assetType;

    @Column(nullable = false, columnDefinition = "text")
    private String url;

    @Column(name = "alt_en", length = 255)
    private String altEn;

    @Column(name = "alt_bn", length = 255)
    private String altBn;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "is_primary", nullable = false)
    private Boolean isPrimary;

    @Column(name = "color_key", length = 64)
    private String colorKey;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (sortOrder == null) sortOrder = 0;
        if (assetType == null) assetType = AssetType.image;
        if (isPrimary == null) isPrimary = false;
    }
}
