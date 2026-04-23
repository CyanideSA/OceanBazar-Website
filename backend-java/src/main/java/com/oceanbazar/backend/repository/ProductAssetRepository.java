package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.ProductAssetEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductAssetRepository extends JpaRepository<ProductAssetEntity, Integer> {
    List<ProductAssetEntity> findByProductIdOrderBySortOrderAsc(String productId);
    List<ProductAssetEntity> findByProductIdAndAssetTypeOrderBySortOrderAsc(String productId, com.oceanbazar.backend.entity.enums.AssetType assetType);
    void deleteByProductId(String productId);
}
