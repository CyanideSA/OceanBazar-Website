package com.oceanbazar.backend.events;

public record ReturnSubmittedEvent(String userId, String orderId, String returnRequestId, String disputeId) {}
