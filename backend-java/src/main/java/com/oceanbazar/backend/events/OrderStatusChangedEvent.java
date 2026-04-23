package com.oceanbazar.backend.events;

public record OrderStatusChangedEvent(String userId, String orderId, String orderNumber, String status) {}
