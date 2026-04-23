package com.oceanbazar.backend.events;

public record OrderTrackingChangedEvent(String userId, String orderId, String orderNumber, String trackingNumber) {}
