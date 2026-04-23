package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.ProductBannerEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductBannerRepository extends JpaRepository<ProductBannerEntity, Integer> {
    List<ProductBannerEntity> findByProductIdOrderBySortOrderAsc(String productId);
    List<ProductBannerEntity> findByCategoryIdOrderBySortOrderAsc(String categoryId);
    List<ProductBannerEntity> findByEnabledTrueOrderBySortOrderAsc();
}
