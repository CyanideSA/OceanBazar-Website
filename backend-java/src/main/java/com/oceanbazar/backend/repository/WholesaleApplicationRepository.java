package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.WholesaleApplicationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WholesaleApplicationRepository extends JpaRepository<WholesaleApplicationEntity, String> {
    Optional<WholesaleApplicationEntity> findFirstByUserIdAndStatusIn(String userId, List<String> statuses);
    Optional<WholesaleApplicationEntity> findFirstByUserIdOrderByCreatedAtDesc(String userId);
}
