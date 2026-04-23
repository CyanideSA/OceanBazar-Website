package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Entity 
@Table(name = "products", indexes = {@Index(name = "idx_category_id", columnList = "category_id"), @Index(name = "idx_sku", columnList = "sku"), @Index(name = "idx_status", columnList = "status")})
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductEntity {
    @Id @Column(columnDefinition = "char(8)")
    private String id;

    @Column(name = "title_en", length = 500, nullable = false)
    private String titleEn;

    @Column(name = "title_bn", length = 500, nullable = false)
    private String titleBn;

    @Column(name = "description_en", columnDefinition = "text")
    private String descriptionEn;

    @Column(name = "description_bn", columnDefinition = "text")
    private String descriptionBn;

    @Column(name = "category_id", columnDefinition = "char(8)", nullable = false)
    private String categoryId;

    @Column(name = "seller_id", columnDefinition = "char(8)")
    private String sellerId;

    @Column(name = "brand_id", columnDefinition = "char(8)")
    private String brandId;

    @Column(length = 255)
    private String brand;

    @Column(length = 100)
    private String sku;

    @Column(length = 20, nullable = false)
    private String status;

    @Column(precision = 8, scale = 3)
    private BigDecimal weight;

    @Column(name = "weight_unit", length = 10)
    private String weightUnit;

    @Column(nullable = false)
    private Integer moq;

    @Column(nullable = false)
    private Integer stock;


    @Column(name = "seo_title", length = 255)
    private String seoTitle;

    @Column(name = "seo_description", columnDefinition = "text")
    private String seoDescription;

    @Column(name = "import_source")
    private String importSource;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String specifications;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attributes_extra", columnDefinition = "jsonb")
    private String attributesExtra;

    @Column(name = "rating_avg", precision = 3, scale = 2)
    private BigDecimal ratingAvg;

    @Column(name = "review_count", nullable = false)
    private Integer reviewCount;

    @Column(name = "brand_logo_url", length = 500)
    private String brandLogoUrl;

    @Column(name = "popularity_rank")
    private Integer popularityRank;

    @Column(name = "popularity_label_en", length = 255)
    private String popularityLabelEn;

    @Column(name = "popularity_label_bn", length = 255)
    private String popularityLabelBn;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "reviews_snapshot", columnDefinition = "jsonb")
    private String reviewsSnapshot;

    @Column(name = "is_featured", nullable = false)
    private Boolean isFeatured;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "productId", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProductPricingEntity> pricing;

    @OneToMany(mappedBy = "productId", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProductAssetEntity> assets;

    @OneToMany(mappedBy = "productId", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProductVariantEntity> variants;

    @OneToMany(mappedBy = "productId", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProductAttributeEntity> attributes;

    @PrePersist void prePersist() {
        Instant n = Instant.now();
        if (createdAt == null) createdAt = n;
        if (updatedAt == null) updatedAt = n;
        if (status == null) status = "draft";
        if (moq == null) moq = 1;
        if (stock == null) stock = 0;
        if (reviewCount == null) reviewCount = 0;
        if (isFeatured == null) isFeatured = false;
    }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
