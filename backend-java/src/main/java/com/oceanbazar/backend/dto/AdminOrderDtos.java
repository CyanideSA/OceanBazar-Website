package com.oceanbazar.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class AdminOrderDtos {

    @Data
    public static class AdminOrderStatusUpdateRequest {
        @NotBlank
        private String status;

        @Size(max = 2000, message = "Note must be at most 2000 characters")
        private String note;
    }

    @Data
    public static class AdminPaymentStatusUpdateRequest {
        @NotBlank
        private String paymentStatus;

        @Size(max = 2000, message = "Note must be at most 2000 characters")
        private String note;
    }

    @Data
    public static class AdminOrderTrackingUpdateRequest {
        /** Empty or blank clears tracking on the order. */
        @Size(max = 128, message = "Tracking number must be at most 128 characters")
        private String trackingNumber;

        @Size(max = 2000, message = "Note must be at most 2000 characters")
        private String note;
    }
}

