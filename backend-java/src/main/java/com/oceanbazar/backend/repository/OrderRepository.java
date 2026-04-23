package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<OrderEntity, String> {
    Optional<OrderEntity> findByOrderNumber(String orderNumber);
    List<OrderEntity> findByUserIdOrderByCreatedAtDesc(String userId);
    List<OrderEntity> findByUserIdAndStatusOrderByCreatedAtDesc(String userId, OrderStatus status);
    long countByUserId(String userId);
    boolean existsByOrderNumber(String orderNumber);
    long countByUserIdAndCouponId(String userId, Integer couponId);
}
