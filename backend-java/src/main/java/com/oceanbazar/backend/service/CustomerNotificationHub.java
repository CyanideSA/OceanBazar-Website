package com.oceanbazar.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oceanbazar.backend.entity.NotificationEntity;
import com.oceanbazar.backend.observability.RealtimeMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * In-memory SSE fan-out per customer userId. For horizontal scale use sticky sessions or a shared broker.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CustomerNotificationHub {
    private final ObjectMapper objectMapper;
    private final RealtimeMetrics realtimeMetrics;
    private final WebSocketBroadcastService webSocketBroadcastService;
    private final ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> subscribers = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String userId) {
        realtimeMetrics.sseCustomerSubscriptions.increment();
        SseEmitter emitter = new SseEmitter(0L);
        CopyOnWriteArrayList<SseEmitter> list =
                subscribers.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>());
        list.add(emitter);
        Runnable remove = () -> {
            list.remove(emitter);
            if (list.isEmpty()) {
                subscribers.remove(userId, list);
            }
        };
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(e -> remove.run());
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException e) {
            remove.run();
            return emitter;
        }
        return emitter;
    }

    public void publish(NotificationEntity n) {
        if (n == null || n.getUserId() == null || n.getUserId().isBlank()) {
            return;
        }
        realtimeMetrics.sseCustomerNotificationEvents.increment();
        sendJson(n.getUserId(), "notification", toPayload(n));
    }

    public void publishOrderUpdate(String userId, Map<String, Object> payload) {
        if (userId == null || userId.isBlank()) {
            return;
        }
        webSocketBroadcastService.pushCustomerOrderStream(userId, payload);
    }

    public void publishReturnUpdate(String userId, Map<String, Object> payload) {
        if (userId == null || userId.isBlank()) {
            return;
        }
        webSocketBroadcastService.pushCustomerReturnStream(userId, payload);
    }

    private void sendJson(String userId, String eventName, Map<String, Object> payload) {
        CopyOnWriteArrayList<SseEmitter> list = subscribers.get(userId);
        if (list == null || list.isEmpty()) {
            return;
        }
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            log.warn("Could not serialize SSE payload for {}", eventName);
            return;
        }
        for (SseEmitter emitter : List.copyOf(list)) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(json));
            } catch (Exception ex) {
                list.remove(emitter);
                try {
                    emitter.complete();
                } catch (Exception ignored) {
                }
            }
        }
    }

    private static Map<String, Object> toPayload(NotificationEntity n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", n.getId() != null ? n.getId() : "");
        m.put("userId", n.getUserId() != null ? n.getUserId() : "");
        m.put("title", n.getTitle() != null ? n.getTitle() : "");
        m.put("message", n.getMessage() != null ? n.getMessage() : "");
        if (n.getImage() != null && !n.getImage().isBlank()) {
            m.put("image", n.getImage());
        }
        m.put("kind", n.getKind() != null ? n.getKind() : "system");
        m.put("entityId", n.getEntityId() != null ? n.getEntityId() : "");
        boolean read = Boolean.TRUE.equals(n.getReadStatus());
        m.put("read", read);
        m.put("readStatus", read);
        m.put("createdAt", n.getCreatedAt() != null ? n.getCreatedAt().toEpochMilli() : System.currentTimeMillis());
        return m;
    }
}
