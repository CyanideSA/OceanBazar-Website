package com.oceanbazar.backend.domain;

import lombok.Data;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Domain-level payment representation.
 *
 * Persistence today uses {@code PaymentTransaction} for ledger/history; this type exists to decouple
 * higher-level application logic from the persistence document.
 */
@Data
public class Payment {
    private String id = UUID.randomUUID().toString();
    private String orderId;
    private String userId;
    private String paymentMethod;
    private String status;
    private String providerTransactionId;
    private String trackingNumber;
    private Double amount = 0.0;
    private String currency = "BDT";
    private Map<String, Object> metadata = new HashMap<>();
    private Date createdAt = new Date();
    private Date updatedAt = new Date();

    private List<StatusChange> statusHistory = new ArrayList<>();

    @Data
    public static class StatusChange {
        private String id = UUID.randomUUID().toString();
        private Date at = new Date();
        private String fromStatus;
        private String toStatus;
        private String note;
        private String actor; // admin_id / webhook_provider
        private Map<String, Object> details = new HashMap<>();
    }
}

