package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.CouponEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<CouponEntity, Integer> {
    Optional<CouponEntity> findByCode(String code);
    List<CouponEntity> findByActiveTrue();
    boolean existsByCode(String code);
}
