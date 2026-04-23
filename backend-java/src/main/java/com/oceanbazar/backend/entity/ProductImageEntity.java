package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.MediaType;
import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "product_images")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductImageEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "product_id", columnDefinition = "char(8)", nullable = false)
    private String productId;

    @Column(nullable = false)
    private String url;

    @Column(name = "alt_en", length = 255)
    private String altEn;

    @Column(name = "alt_bn", length = 255)
    private String altBn;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "media_type", nullable = false)
    private MediaType mediaType;

    @Column(name = "is_primary", nullable = false)
    private Boolean isPrimary;

    @Column(name = "color_key", length = 64)
    private String colorKey;

    @PrePersist void prePersist() { if (sortOrder == null) sortOrder = 0; if (mediaType == null) mediaType = MediaType.image; if (isPrimary == null) isPrimary = false; }
}
