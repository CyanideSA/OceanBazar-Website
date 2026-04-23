package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.ProductVariantEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariantEntity, String> {
    List<ProductVariantEntity> findByProductId(String productId);
    Optional<ProductVariantEntity> findBySku(String sku);
    List<ProductVariantEntity> findByProductIdAndIsActiveTrue(String productId);
    void deleteByProductId(String productId);
}
