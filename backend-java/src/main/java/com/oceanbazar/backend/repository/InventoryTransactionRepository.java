package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.InventoryTransactionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryTransactionRepository extends JpaRepository<InventoryTransactionEntity, String> {
    List<InventoryTransactionEntity> findByProductIdOrderByCreatedAtDesc(String productId);
    List<InventoryTransactionEntity> findByInventoryItemIdOrderByCreatedAtDesc(String inventoryItemId);
    List<InventoryTransactionEntity> findByOrderId(String orderId);
}
