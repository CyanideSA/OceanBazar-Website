package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.ProductTagEntity;
import com.oceanbazar.backend.entity.ProductTagId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductTagRepository extends JpaRepository<ProductTagEntity, ProductTagId> {
    List<ProductTagEntity> findByProductId(String productId);
    List<ProductTagEntity> findByTagId(Integer tagId);
    void deleteByProductId(String productId);
    void deleteByProductIdAndTagId(String productId, Integer tagId);
}
