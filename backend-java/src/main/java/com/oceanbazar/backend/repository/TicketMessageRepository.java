package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.TicketMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketMessageRepository extends JpaRepository<TicketMessageEntity, Integer> {
    List<TicketMessageEntity> findByTicketIdOrderByCreatedAtAsc(String ticketId);
}
