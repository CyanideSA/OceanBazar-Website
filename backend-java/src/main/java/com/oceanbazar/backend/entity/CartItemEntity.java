package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.CustomerType;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity @Table(name = "cart_items")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class CartItemEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "cart_id", nullable = false)
    private Integer cartId;

    @Column(name = "product_id", columnDefinition = "char(8)", nullable = false)
    private String productId;

    @Column(name = "variant_id", columnDefinition = "char(8)")
    private String variantId;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", precision = 12, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "customer_type", nullable = false)
    private CustomerType customerType;
}
