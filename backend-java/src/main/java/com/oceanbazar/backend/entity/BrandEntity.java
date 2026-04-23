package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "brands")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class BrandEntity {
    @Id @Column(columnDefinition = "char(8)")
    private String id;

    @Column(name = "name_en", length = 255, nullable = false)
    private String nameEn;

    @Column(name = "name_bn", length = 255, nullable = false)
    private String nameBn;

    @Column(length = 255, unique = true, nullable = false)
    private String slug;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(nullable = false)
    private Boolean active;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() {
        Instant n = Instant.now();
        if (createdAt == null) createdAt = n;
        if (updatedAt == null) updatedAt = n;
        if (sortOrder == null) sortOrder = 0;
        if (active == null) active = true;
    }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
