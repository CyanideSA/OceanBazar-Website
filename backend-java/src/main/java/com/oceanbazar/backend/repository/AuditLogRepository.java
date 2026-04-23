package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.AuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AuditLogRepository extends JpaRepository<AuditLogEntity, Integer>, JpaSpecificationExecutor<AuditLogEntity> {
}
