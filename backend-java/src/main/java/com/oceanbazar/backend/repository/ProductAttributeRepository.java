package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.ProductAttributeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductAttributeRepository extends JpaRepository<ProductAttributeEntity, Integer> {
    List<ProductAttributeEntity> findByProductIdOrderBySortOrderAsc(String productId);
    void deleteByProductId(String productId);
}
