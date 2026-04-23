package com.oceanbazar.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oceanbazar.backend.events.CustomerChatMessageEvent;
import com.oceanbazar.backend.events.DomainEventPublisher;
import com.oceanbazar.backend.entity.ChatSessionEntity;
import com.oceanbazar.backend.repository.ChatSessionRepository;
import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.service.ChatRealtimeService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {
    private static final String WELCOME_BOT = "Hello! Welcome to OceanBazar — thanks for reaching out. A member of our team will join you shortly. In the meantime, is there anything specific we can note for your order or account?";
    private static final String REOPEN_BOT = "It is wonderful to hear from you again. We are here for anything you need — how can we assist you today?";

    private final ChatSessionRepository chatSessionRepository;
    private final AuthTokenService authTokenService;
    private final DomainEventPublisher domainEventPublisher;
    private final ChatRealtimeService chatRealtimeService;
    private final ObjectMapper objectMapper;

    @GetMapping("/session")
    public Map<String, Object> getChatSession(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return chatRealtimeService.buildSessionPayload(userId);
    }

    @PostMapping("/message")
    public Map<String, Object> sendMessage(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody ChatMessageRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        Instant now = Instant.now();

        ChatSessionEntity session = chatSessionRepository.findByUserIdAndIsActive(userId, true).orElse(null);
        if (session == null) {
            Optional<ChatSessionEntity> last = chatSessionRepository.findFirstByUserIdOrderByLastMessageAtDesc(userId);
            if (last.isPresent()) {
                session = last.get();
                session.setIsActive(true);
            } else {
                session = new ChatSessionEntity();
                session.setId(UUID.randomUUID().toString());
                session.setUserId(userId);
                session.setIsActive(true);
                session.setCreatedAt(now);
                session.setLastMessageAt(now);
                session.setMessages("[]");
                session.setAgentEngaged(false);
            }
        }

        List<Map<String, Object>> messages = readMessages(session.getMessages());

        long priorUserSends = messages.stream()
                .filter(m -> "user".equals(String.valueOf(m.get("sender"))))
                .count();

        Map<String, Object> msg = new LinkedHashMap<>();
        msg.put("id", UUID.randomUUID().toString());
        msg.put("userId", userId);
        msg.put("message", request.getMessage());
        msg.put("sender", request.getSender() == null ? "user" : request.getSender());
        msg.put("timestamp", now.toEpochMilli());
        msg.put("isRead", false);
        if (request.getClientMsgId() != null) {
            msg.put("clientMsgId", request.getClientMsgId());
        }
        // Deduplication check
        boolean isDuplicate = messages.stream().anyMatch(m -> 
            request.getClientMsgId() != null && request.getClientMsgId().equals(m.get("clientMsgId"))
        );
        if (isDuplicate) {
            return Map.of("success", true, "message", "Duplicate message skipped", "session", chatRealtimeService.toPayload(session));
        }
        messages.add(msg);
        try {
            session.setMessages(objectMapper.writeValueAsString(messages));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save message");
        }
        session.setLastMessageAt(now);

        if ("user".equals(msg.get("sender"))) {
            boolean engaged = Boolean.TRUE.equals(session.getAgentEngaged());
            if (!engaged) {
                if (priorUserSends == 0) {
                    appendBot(session, WELCOME_BOT);
                } else if (session.getClosedByAgentAt() != null) {
                    appendBot(session, REOPEN_BOT);
                    session.setClosedByAgentAt(null);
                }
            }
        }

        chatSessionRepository.save(session);

        chatRealtimeService.publishUserChatSession(userId);

        if ("user".equals(msg.get("sender"))) {
            domainEventPublisher.publish(new CustomerChatMessageEvent(userId, session.getId()));
        }

        return Map.of("success", true, "session", chatRealtimeService.toPayload(session));
    }

    @PostMapping("/session/close")
    public Map<String, Object> closeSession(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        chatSessionRepository.findByUserIdAndIsActive(userId, true).ifPresent(session -> {
            session.setIsActive(false);
            chatSessionRepository.save(session);
            chatRealtimeService.publishUserChatSession(userId);
        });
        return Map.of("success", true, "message", "Session closed");
    }

    @PostMapping("/session/minimize")
    public Map<String, Object> minimizeSession(@RequestHeader(value = "Authorization", required = false) String authorization) {
        authTokenService.getUserIdFromAuthorization(authorization);
        return Map.of("success", true, "message", "Session minimized");
    }

    private List<Map<String, Object>> readMessages(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private void appendBot(ChatSessionEntity session, String text) {
        try {
            List<Map<String, Object>> messages = readMessages(session.getMessages());
            Instant now = Instant.now();
            Map<String, Object> auto = new LinkedHashMap<>();
            auto.put("id", UUID.randomUUID().toString());
            auto.put("userId", session.getUserId());
            auto.put("message", text);
            auto.put("sender", "bot");
            auto.put("timestamp", now.toEpochMilli());
            auto.put("isRead", false);
            messages.add(auto);
            session.setMessages(objectMapper.writeValueAsString(messages));
            session.setLastMessageAt(now);
        } catch (Exception ignored) {
        }
    }

    @Data
    public static class ChatMessageRequest {
        @NotBlank
        private String message;
        private String sender = "user";
        private String clientMsgId; // Add optional clientMsgId for deduplication
    }
}
