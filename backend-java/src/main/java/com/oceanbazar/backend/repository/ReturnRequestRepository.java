package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.ReturnRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReturnRequestRepository extends JpaRepository<ReturnRequestEntity, String> {
    List<ReturnRequestEntity> findByUserId(String userId);
    List<ReturnRequestEntity> findByOrderId(String orderId);
    List<ReturnRequestEntity> findBySellerId(String sellerId);
    List<ReturnRequestEntity> findByStatus(String status);
    List<ReturnRequestEntity> findByAssignedToAdminId(String adminId);
}
