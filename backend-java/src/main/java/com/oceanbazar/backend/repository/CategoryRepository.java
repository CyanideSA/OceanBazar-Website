package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.CategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<CategoryEntity, String> {
    boolean existsByNameEnIgnoreCase(String nameEn);
    Optional<CategoryEntity> findByNameEnIgnoreCase(String nameEn);
    Optional<CategoryEntity> findBySlug(String slug);
    boolean existsBySlug(String slug);
    List<CategoryEntity> findByParentIdIsNullOrderBySortOrderAscNameEnAsc();
    List<CategoryEntity> findByParentIdOrderBySortOrderAscNameEnAsc(String parentId);
    List<CategoryEntity> findByParentId(String parentId);
    long countByParentId(String parentId);

    @Query("SELECT c FROM CategoryEntity c ORDER BY c.depth ASC, c.sortOrder ASC, c.nameEn ASC")
    List<CategoryEntity> findAllOrderedForTree();

    @Query("SELECT c FROM CategoryEntity c WHERE LOWER(c.nameEn) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(c.nameBn) LIKE LOWER(CONCAT('%', :q, '%'))")
    List<CategoryEntity> searchByName(String q);
}
