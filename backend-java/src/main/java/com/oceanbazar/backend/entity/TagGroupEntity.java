package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.util.List;

@Entity @Table(name = "tag_groups")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class TagGroupEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "name_en", length = 100, nullable = false)
    private String nameEn;

    @Column(name = "name_bn", length = 100, nullable = false)
    private String nameBn;

    @Column(length = 100, nullable = false, unique = true)
    private String slug;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @OneToMany(mappedBy = "groupId", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<TagEntity> tags;

    @PrePersist void prePersist() { if (sortOrder == null) sortOrder = 0; }
}
