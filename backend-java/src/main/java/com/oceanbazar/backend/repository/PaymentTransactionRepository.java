package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.PaymentTransactionEntity;
import com.oceanbazar.backend.entity.enums.PaymentMethod;
import com.oceanbazar.backend.entity.enums.PaymentTxStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransactionEntity, String> {
    Optional<PaymentTransactionEntity> findTopByOrderIdAndMethodOrderByCreatedAtDesc(String orderId, PaymentMethod method);
    Optional<PaymentTransactionEntity> findTopByOrderIdOrderByCreatedAtDesc(String orderId);
    List<PaymentTransactionEntity> findByStatusOrderByCreatedAtDesc(PaymentTxStatus status);
}
