package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.ProductPricingEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface ProductPricingRepository extends JpaRepository<ProductPricingEntity, Integer> {
    List<ProductPricingEntity> findByProductIdOrderBySortOrderAsc(String productId);
    Optional<ProductPricingEntity> findByProductIdAndCustomerType(String productId, String customerType);

    @Transactional
    void deleteByProductId(String productId);
}
