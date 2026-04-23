package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity @Table(name = "product_pricing", uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "customer_type"}))
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductPricingEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "product_id", columnDefinition = "char(8)", nullable = false)
    private String productId;

    @Column(name = "customer_type", length = 20, nullable = false)
    private String customerType;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal price;

    @Column(name = "compare_at", precision = 12, scale = 2)
    private BigDecimal compareAt;

    @Column(name = "tier1_min_qty")
    private Integer tier1MinQty;

    @Column(name = "tier1_discount", precision = 5, scale = 2)
    private BigDecimal tier1Discount;

    @Column(name = "tier2_min_qty")
    private Integer tier2MinQty;

    @Column(name = "tier2_discount", precision = 5, scale = 2)
    private BigDecimal tier2Discount;

    @Column(name = "tier3_min_qty")
    private Integer tier3MinQty;

    @Column(name = "tier3_discount", precision = 5, scale = 2)
    private BigDecimal tier3Discount;
}
