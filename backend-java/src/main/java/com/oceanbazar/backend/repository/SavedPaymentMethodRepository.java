package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.SavedPaymentMethodEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SavedPaymentMethodRepository extends JpaRepository<SavedPaymentMethodEntity, String> {
    List<SavedPaymentMethodEntity> findByUserIdOrderByCreatedAtDesc(String userId);
    long countByUserId(String userId);
}
