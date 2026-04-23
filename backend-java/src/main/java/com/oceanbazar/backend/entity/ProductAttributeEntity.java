package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "product_attributes",
    uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "attr_key"}))
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductAttributeEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "product_id", columnDefinition = "char(8)", nullable = false)
    private String productId;

    @Column(name = "attr_key", length = 100, nullable = false)
    private String attrKey;

    @Column(name = "attr_value", nullable = false, columnDefinition = "text")
    private String attrValue;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @PrePersist void prePersist() { if (sortOrder == null) sortOrder = 0; }
}
