package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.TicketEntity;
import com.oceanbazar.backend.entity.enums.TicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface TicketRepository extends JpaRepository<TicketEntity, String>, JpaSpecificationExecutor<TicketEntity> {
    List<TicketEntity> findByUserIdOrderByUpdatedAtDesc(String userId);
    long countByStatus(TicketStatus status);
}
