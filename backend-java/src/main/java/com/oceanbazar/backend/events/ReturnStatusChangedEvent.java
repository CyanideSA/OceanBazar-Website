package com.oceanbazar.backend.events;

public record ReturnStatusChangedEvent(String userId, String orderId, String returnRequestId, String status) {}
