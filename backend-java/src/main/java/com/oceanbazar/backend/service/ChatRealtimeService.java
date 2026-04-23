package com.oceanbazar.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oceanbazar.backend.entity.ChatSessionEntity;
import com.oceanbazar.backend.repository.ChatSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds chat session payloads for the storefront and pushes them on {@code /user/queue/chat}.
 */
@Service
@RequiredArgsConstructor
public class ChatRealtimeService {
    private final ChatSessionRepository chatSessionRepository;
    private final WebSocketBroadcastService webSocketBroadcastService;
    private final ObjectMapper objectMapper;

    public Map<String, Object> buildSessionPayload(String userId) {
        if (userId == null || userId.isBlank()) {
            return emptyPayload("");
        }
        return chatSessionRepository.findByUserIdAndIsActive(userId, true)
                .map(this::toPayload)
                .orElseGet(() -> chatSessionRepository.findFirstByUserIdOrderByLastMessageAtDesc(userId)
                        .map(this::toPayload)
                        .orElseGet(() -> emptyPayload(userId)));
    }

    public Map<String, Object> toPayload(ChatSessionEntity session) {
        if (session == null) {
            return emptyPayload("");
        }
        Map<String, Object> out = new HashMap<>();
        out.put("id", session.getId());
        out.put("userId", session.getUserId());
        out.put("messages", parseMessages(session.getMessages()));
        out.put("isActive", session.getIsActive());
        out.put("agentEngaged", Boolean.TRUE.equals(session.getAgentEngaged()));
        out.put("lastMessageAt", session.getLastMessageAt());
        out.put("createdAt", session.getCreatedAt());
        return out;
    }

    public void publishUserChatSession(String userId) {
        if (userId == null || userId.isBlank()) {
            return;
        }
        webSocketBroadcastService.pushCustomerChat(userId.trim(), buildSessionPayload(userId));
    }

    private List<Object> parseMessages(String messagesJson) {
        if (messagesJson == null || messagesJson.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(messagesJson, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static Map<String, Object> emptyPayload(String userId) {
        Map<String, Object> out = new HashMap<>();
        out.put("id", null);
        out.put("userId", userId);
        out.put("messages", List.of());
        out.put("isActive", false);
        out.put("agentEngaged", false);
        out.put("lastMessageAt", null);
        out.put("createdAt", null);
        return out;
    }
}
