package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.WarehouseEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WarehouseRepository extends JpaRepository<WarehouseEntity, String> {
    List<WarehouseEntity> findByActiveTrue();
    Optional<WarehouseEntity> findByCode(String code);
    Optional<WarehouseEntity> findByIsPrimaryTrue();
}
