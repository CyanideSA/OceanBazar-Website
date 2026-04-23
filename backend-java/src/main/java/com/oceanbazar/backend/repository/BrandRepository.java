package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.BrandEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface BrandRepository extends JpaRepository<BrandEntity, String> {
    Optional<BrandEntity> findBySlug(String slug);
    boolean existsBySlug(String slug);
    List<BrandEntity> findAllByActiveTrueOrderBySortOrderAscNameEnAsc();

    @Query("SELECT b FROM BrandEntity b WHERE LOWER(b.nameEn) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(b.nameBn) LIKE LOWER(CONCAT('%', :q, '%'))")
    List<BrandEntity> searchByName(String q);
}
