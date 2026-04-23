package com.oceanbazar.backend.events;

public record OrderPaymentChangedEvent(String userId, String orderId, String orderNumber, String paymentStatus) {}
