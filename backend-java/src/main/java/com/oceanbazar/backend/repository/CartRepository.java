package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.CartEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CartRepository extends JpaRepository<CartEntity, Integer> {
    Optional<CartEntity> findByUserId(String userId);

    @Query("SELECT c FROM CartEntity c LEFT JOIN FETCH c.items WHERE c.userId = :userId")
    Optional<CartEntity> findByUserIdWithItems(@Param("userId") String userId);
}
