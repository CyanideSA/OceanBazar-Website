package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface UserRepository extends JpaRepository<UserEntity, String> {
    Optional<UserEntity> findByEmail(String email);
    boolean existsByEmail(String email);
    Optional<UserEntity> findByPhone(String phone);
    boolean existsByPhone(String phone);

    @Transactional
    @Modifying
    @Query(value = "UPDATE users SET password_hash = :hash WHERE email = :email", nativeQuery = true)
    int updatePasswordByEmailNative(@Param("email") String email, @Param("hash") String passwordHash);
}
