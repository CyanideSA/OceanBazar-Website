package com.oceanbazar.backend.events;

public record CustomerChatMessageEvent(String userId, String sessionId) {}
