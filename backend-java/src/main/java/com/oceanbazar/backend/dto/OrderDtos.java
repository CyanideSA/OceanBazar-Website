package com.oceanbazar.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;
import java.util.List;
import java.util.Date;

public class OrderDtos {

    @Data
    public static class OrderFeedbackRequest {
        @Min(1)
        @Max(5)
        private Integer rating;
        @Size(max = 2000)
        private String comment;
    }

    @Data
    public static class PlaceOrderRequest {
        // Free-form address fields (frontend may send any shape: city/state/zip/house/etc.)
        private Map<String, Object> shippingAddress;

        /** Optional client key for deduplication (not persisted; reserved for future use). */
        @Size(max = 200)
        private String idempotencyKey;

        /**
         * Optional coupon code. If provided, backend will validate and apply
         * discount during checkout (affects GST/service fee/shipping calculations).
         */
        private String couponCode;

        // Used for payment placeholder/future gateway integration.
        @NotBlank
        private String paymentMethod;
    }

    @Data
    public static class OrderItemDto {
        private String productId;
        private String name;
        private String category;
        private String imageUrl;
        private Double unitPrice;
        private Integer quantity;
        private Double lineTotal;
    }

    @Data
    public static class OrderResponseDto {
        private String id;
        /** 8-char uppercase hex reference shown to customers (e.g. A3F9B2C1). */
        private String orderNumber;
        private String userId;
        private List<OrderItemDto> items;
        private Double subtotal;
        private Double shipping;
        private Double gst;
        private Double serviceFee;
        private Double total;
        private String status;
        private String trackingNumber;
        private String paymentMethod;
        private String paymentStatus;
        private Map<String, Object> shippingAddress;
        private Date createdAt;
        private String returnStatus;
        private String returnReason;
        private Integer buyerRating;
        private String buyerFeedback;
        private Date buyerFeedbackAt;
    }

    @Data
    public static class OrderListResponseDto {
        private List<OrderResponseDto> orders;
        private int total;
        private int page;
        private int totalPages;
    }

    @Data
    public static class RecentOrdersResponseDto {
        private List<OrderResponseDto> orders;
    }

    @Data
    public static class OrderDashboardStatsDto {
        private int totalOrders;
        private Double totalSpent;
        private Double avgOrderValue;
        private long pendingOrders;
    }

    @Data
    public static class OrderTrackingStepDto {
        private String key;
        private String label;
        private boolean completed;
        private boolean current;
        private Date occurredAt;
        private String detail;
    }

    @Data
    public static class OrderTrackingLogEntryDto {
        private Date at;
        private String type;
        private String message;
        private String status;
        private String previousStatus;
    }

    @Data
    public static class OrderTrackingResponseDto {
        private String orderId;
        private String orderNumber;
        private String status;
        private String trackingNumber;
        private Date createdAt;
        private boolean cancelled;
        /** 0–4 fulfillment step, or -1 when cancelled. */
        private int currentStepIndex;
        private List<OrderTrackingStepDto> steps;
        /** Chronological log derived from {@code Order.timeline} (latest 80). */
        private List<OrderTrackingLogEntryDto> events;
    }
}

