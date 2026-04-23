package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.DomainEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DomainEventRepository extends JpaRepository<DomainEventEntity, String> {
    List<DomainEventEntity> findByStatus(String status);
    List<DomainEventEntity> findByAggregateTypeAndAggregateId(String aggregateType, String aggregateId);
    List<DomainEventEntity> findByStatusAndRetryCountLessThan(String status, int maxRetries);
}
