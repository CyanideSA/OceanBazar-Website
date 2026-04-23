package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "tags")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class TagEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "group_id")
    private Integer groupId;

    @Column(name = "name_en", length = 100, nullable = false)
    private String nameEn;

    @Column(name = "name_bn", length = 100, nullable = false)
    private String nameBn;

    @Column(length = 100, nullable = false, unique = true)
    private String slug;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @PrePersist void prePersist() { if (sortOrder == null) sortOrder = 0; }
}
