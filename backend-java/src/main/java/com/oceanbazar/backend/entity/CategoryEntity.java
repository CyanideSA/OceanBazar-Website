package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "categories")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class CategoryEntity {
    @Id @Column(columnDefinition = "char(8)")
    private String id;

    @Column(name = "parent_id", columnDefinition = "char(8)")
    private String parentId;

    @Column(name = "name_en", length = 255, nullable = false)
    private String nameEn;

    @Column(name = "name_bn", length = 255, nullable = false)
    private String nameBn;

    @Column(length = 255, nullable = false, unique = true)
    private String slug;

    @Column(length = 120)
    private String icon;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(nullable = false)
    private Integer depth;

    @Column(nullable = false, columnDefinition = "text")
    private String path;

    @Column(name = "is_leaf", nullable = false)
    private Boolean isLeaf;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() {
        Instant n = Instant.now();
        if (createdAt == null) createdAt = n;
        if (updatedAt == null) updatedAt = n;
        if (sortOrder == null) sortOrder = 0;
        if (depth == null) depth = 0;
        if (path == null) path = "";
        if (isLeaf == null) isLeaf = true;
    }

    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
