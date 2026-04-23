package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.SupportAgentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SupportAgentRepository extends JpaRepository<SupportAgentEntity, String> {
    Optional<SupportAgentEntity> findByAgentId(String agentId);
}
