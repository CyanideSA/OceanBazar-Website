package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.TagEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface TagRepository extends JpaRepository<TagEntity, Integer> {
    Optional<TagEntity> findBySlug(String slug);
    boolean existsBySlug(String slug);
    List<TagEntity> findByGroupIdOrderBySortOrderAsc(Integer groupId);

    @Query("SELECT t FROM TagEntity t WHERE LOWER(t.nameEn) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(t.nameBn) LIKE LOWER(CONCAT('%', :q, '%'))")
    List<TagEntity> searchByName(String q);
}
