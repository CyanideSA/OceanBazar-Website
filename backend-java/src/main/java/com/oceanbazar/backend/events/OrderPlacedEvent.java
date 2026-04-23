package com.oceanbazar.backend.events;

public record OrderPlacedEvent(String userId, String orderId, String orderNumber, String status) {}
