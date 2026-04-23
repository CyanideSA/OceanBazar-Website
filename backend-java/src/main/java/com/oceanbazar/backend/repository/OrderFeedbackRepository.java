package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.OrderFeedbackEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderFeedbackRepository extends JpaRepository<OrderFeedbackEntity, String> {
    boolean existsByOrderId(String orderId);
}
