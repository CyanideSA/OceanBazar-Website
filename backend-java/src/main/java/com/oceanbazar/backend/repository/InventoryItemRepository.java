package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.InventoryItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryItemRepository extends JpaRepository<InventoryItemEntity, String> {
    List<InventoryItemEntity> findByProductId(String productId);
    Optional<InventoryItemEntity> findByProductIdAndWarehouseId(String productId, String warehouseId);
    Optional<InventoryItemEntity> findByVariantIdAndWarehouseId(String variantId, String warehouseId);
    List<InventoryItemEntity> findByStatus(String status);
    List<InventoryItemEntity> findByWarehouseId(String warehouseId);
    List<InventoryItemEntity> findByQuantityAvailableLessThanEqual(int threshold);
}
