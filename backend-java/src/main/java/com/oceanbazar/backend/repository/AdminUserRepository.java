package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.AdminUserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AdminUserRepository extends JpaRepository<AdminUserEntity, Integer> {
    Optional<AdminUserEntity> findByUsername(String username);
    Optional<AdminUserEntity> findByEmail(String email);
    boolean existsByUsername(String username);
}
