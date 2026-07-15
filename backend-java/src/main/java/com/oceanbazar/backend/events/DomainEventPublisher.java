package com.oceanbazar.backend.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class DomainEventPublisher {

    public static final String EVENTS_STREAM = "ob:events";

    private final ApplicationEventPublisher applicationEventPublisher;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public void publish(DomainEventType type, Map<String, Object> payload, String aggregateId, String userId) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("id", "evt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        event.put("type", type.name());
        event.put("occurredAt", Instant.now().toString());
        if (aggregateId != null) event.put("aggregateId", aggregateId);
        if (userId != null) event.put("userId", userId);
        event.put("payload", payload != null ? payload : Map.of());

        applicationEventPublisher.publishEvent(new PlatformDomainEvent(type, event));
        try {
            redis.convertAndSend(EVENTS_STREAM, objectMapper.writeValueAsString(event));
        } catch (Exception e) {
            log.debug("Redis event publish skipped: {}", e.getMessage());
        }
    }

    public void publish(OrderPlacedEvent e) {
        publish(DomainEventType.OrderPlaced, Map.of(
                "orderId", e.orderId(),
                "orderNumber", e.orderNumber(),
                "status", e.status()
        ), e.orderId(), e.userId());
    }

    public void publish(OrderStatusChangedEvent e) {
        publish(DomainEventType.OrderStatusChanged, Map.of(
                "orderId", e.orderId(),
                "orderNumber", e.orderNumber(),
                "status", e.status()
        ), e.orderId(), e.userId());
    }

    public void publish(OrderPaymentChangedEvent e) {
        publish(DomainEventType.OrderPaymentChanged, Map.of(
                "orderId", e.orderId(),
                "orderNumber", e.orderNumber(),
                "paymentStatus", e.paymentStatus()
        ), e.orderId(), e.userId());
    }

    public void publish(OrderTrackingChangedEvent e) {
        publish(DomainEventType.OrderTrackingChanged, Map.of(
                "orderId", e.orderId(),
                "orderNumber", e.orderNumber(),
                "trackingNumber", e.trackingNumber()
        ), e.orderId(), e.userId());
    }

    public void publish(ReturnSubmittedEvent e) {
        publish(DomainEventType.ReturnSubmitted, Map.of(
                "orderId", e.orderId(),
                "returnRequestId", e.returnRequestId(),
                "disputeId", e.disputeId()
        ), e.returnRequestId(), e.userId());
    }

    public void publish(ReturnStatusChangedEvent e) {
        publish(DomainEventType.ReturnStatusChanged, Map.of(
                "orderId", e.orderId(),
                "returnRequestId", e.returnRequestId(),
                "status", e.status()
        ), e.returnRequestId(), e.userId());
    }

    public void publish(CustomerChatMessageEvent e) {
        publish(DomainEventType.CustomerChatMessage, Map.of(
                "sessionId", e.sessionId()
        ), e.sessionId(), e.userId());
    }
}
