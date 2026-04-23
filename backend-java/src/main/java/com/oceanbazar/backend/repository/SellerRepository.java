package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.SellerEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SellerRepository extends JpaRepository<SellerEntity, String> {
    Optional<SellerEntity> findByUserId(String userId);
    List<SellerEntity> findByStatus(String status);
    List<SellerEntity> findByStatusIn(List<String> statuses);
    boolean existsByUserId(String userId);
}
