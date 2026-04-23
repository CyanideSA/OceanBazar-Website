package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.ShipmentEntity;
import com.oceanbazar.backend.entity.enums.ShipmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ShipmentRepository extends JpaRepository<ShipmentEntity, String> {
    List<ShipmentEntity> findByOrderId(String orderId);
    List<ShipmentEntity> findByStatus(ShipmentStatus status);
    Optional<ShipmentEntity> findByTrackingNumber(String trackingNumber);
}
