package com.oceanbazar.backend.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Publishes realtime envelopes to Redis channel {@value #CHANNEL} for the Node BFF Socket.IO bridge.
 * Replaces public STOMP/WebSocket exposure.
 */
@Component
@ConditionalOnBean(StringRedisTemplate.class)
@RequiredArgsConstructor
@Slf4j
public class RealtimeRedisPublisher {

    public static final String CHANNEL = "ob:realtime";

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public void publishToRoom(String room, String event, Map<String, Object> payload) {
        publish("room", room, null, event, payload);
    }

    public void publishToUser(String userId, String event, Map<String, Object> payload) {
        publish("user", null, userId, event, payload);
    }

    public void broadcast(String event, Map<String, Object> payload) {
        publish("broadcast", null, null, event, payload);
    }

    private void publish(String target, String room, String userId, String event, Map<String, Object> payload) {
        try {
            Map<String, Object> envelope = new LinkedHashMap<>();
            envelope.put("target", target);
            if (room != null) envelope.put("room", room);
            if (userId != null) envelope.put("userId", userId);
            envelope.put("event", event);
            envelope.put("payload", payload != null ? payload : Map.of());
            redis.convertAndSend(CHANNEL, objectMapper.writeValueAsString(envelope));
        } catch (Exception e) {
            log.warn("Realtime Redis publish failed: {}", e.getMessage());
        }
    }
}
