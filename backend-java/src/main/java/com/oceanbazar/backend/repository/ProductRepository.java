package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.ProductEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ProductRepository extends JpaRepository<ProductEntity, String> {
    long countByCategoryId(String categoryId);
    List<ProductEntity> findByCategoryIdOrderByTitleEnAsc(String categoryId);
    Page<ProductEntity> findByCategoryId(String categoryId, Pageable pageable);
    List<ProductEntity> findByBrandId(String brandId);

    @Query("SELECT p FROM ProductEntity p WHERE LOWER(p.titleEn) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(p.titleBn) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :q, '%'))")
    List<ProductEntity> searchByTitle(String q);

    @Query("SELECT p FROM ProductEntity p WHERE p.categoryId = :categoryId AND (LOWER(p.titleEn) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(p.titleBn) LIKE LOWER(CONCAT('%', :q, '%')))")
    List<ProductEntity> searchInCategory(String categoryId, String q);

    @Query("SELECT p FROM ProductEntity p WHERE p.categoryId IN :categoryIds")
    Page<ProductEntity> findByCategoryIdIn(List<String> categoryIds, Pageable pageable);
}
