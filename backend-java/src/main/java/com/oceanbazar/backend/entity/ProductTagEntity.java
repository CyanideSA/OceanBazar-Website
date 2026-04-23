package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "product_tags")
@IdClass(ProductTagId.class)
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductTagEntity {
    @Id
    @Column(name = "product_id", columnDefinition = "char(8)")
    private String productId;

    @Id
    @Column(name = "tag_id")
    private Integer tagId;
}
