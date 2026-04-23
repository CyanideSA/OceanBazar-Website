package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.ChatSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChatSessionRepository extends JpaRepository<ChatSessionEntity, String> {
    Optional<ChatSessionEntity> findByUserIdAndIsActive(String userId, Boolean isActive);
    Optional<ChatSessionEntity> findFirstByUserIdOrderByLastMessageAtDesc(String userId);
    long countByIsActive(Boolean isActive);
}
