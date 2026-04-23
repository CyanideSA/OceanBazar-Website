package com.oceanbazar.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oceanbazar.backend.entity.DomainEventEntity;
import com.oceanbazar.backend.repository.DomainEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class DomainEventService {
    private final DomainEventRepository domainEventRepository;
    private final ObjectMapper objectMapper;

    public DomainEventEntity publish(String aggregateType, String aggregateId, String eventType, Map<String, Object> payload) {
        String payloadJson;
        try {
            payloadJson = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            payloadJson = "{}";
        }
        DomainEventEntity event = DomainEventEntity.create(aggregateType, aggregateId, eventType, payloadJson);
        DomainEventEntity saved = domainEventRepository.save(event);
        log.info("Domain event published: {} {} {}", aggregateType, aggregateId, eventType);
        return saved;
    }

    public List<DomainEventEntity> getPendingEvents() {
        return domainEventRepository.findByStatusAndRetryCountLessThan("pending", 5);
    }

    public void markProcessed(String eventId) {
        domainEventRepository.findById(eventId).ifPresent(e -> {
            e.setStatus("published");
            e.setProcessedAt(Instant.now());
            domainEventRepository.save(e);
        });
    }

    public void markFailed(String eventId, String error) {
        domainEventRepository.findById(eventId).ifPresent(e -> {
            e.setRetryCount(e.getRetryCount() + 1);
            e.setProcessingError(error);
            if (e.getRetryCount() >= 5) e.setStatus("failed");
            domainEventRepository.save(e);
        });
    }

    public List<DomainEventEntity> getEventsForAggregate(String aggregateType, String aggregateId) {
        return domainEventRepository.findByAggregateTypeAndAggregateId(aggregateType, aggregateId);
    }
}
