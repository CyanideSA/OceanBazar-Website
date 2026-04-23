package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.SavedAddressEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedAddressRepository extends JpaRepository<SavedAddressEntity, Integer> {
    List<SavedAddressEntity> findByUserId(String userId);
    Optional<SavedAddressEntity> findByUserIdAndIsDefaultTrue(String userId);
}
