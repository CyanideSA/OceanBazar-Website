package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;

@Entity @Table(name = "product_variants")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductVariantEntity {
    @Id @Column(columnDefinition = "char(8)")
    private String id;

    @Column(name = "product_id", columnDefinition = "char(8)", nullable = false)
    private String productId;

    @Column(length = 100)
    private String sku;

    @Column(name = "name_en", length = 255, nullable = false)
    private String nameEn;

    @Column(name = "name_bn", length = 255, nullable = false)
    private String nameBn;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String attributes;

    @Column(name = "price_override", precision = 12, scale = 2)
    private BigDecimal priceOverride;

    @Column(nullable = false)
    private Integer stock;

    @Column(precision = 8, scale = 3)
    private BigDecimal weight;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @PrePersist void prePersist() { if (stock == null) stock = 0; if (isActive == null) isActive = true; if (sortOrder == null) sortOrder = 0; }
}
