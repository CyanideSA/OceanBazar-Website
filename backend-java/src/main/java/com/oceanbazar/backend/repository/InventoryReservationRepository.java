package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.InventoryReservationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface InventoryReservationRepository extends JpaRepository<InventoryReservationEntity, String> {
    List<InventoryReservationEntity> findByOrderId(String orderId);
    List<InventoryReservationEntity> findByUserIdAndStatus(String userId, String status);
    List<InventoryReservationEntity> findByStatusAndExpiresAtBefore(String status, Instant date);
    void deleteByOrderId(String orderId);
}
