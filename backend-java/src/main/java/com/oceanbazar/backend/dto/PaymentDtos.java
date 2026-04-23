package com.oceanbazar.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

public class PaymentDtos {
    @Data
    public static class PaymentPlaceholderRequest {
        @NotBlank
        private String orderId;

        // Example: "COD", "Card", "Bkash", "Nagad" etc.
        @NotBlank
        private String paymentMethod;
    }

    @Data
    public static class PaymentOrderIdRequest {
        @NotBlank
        private String orderId;
    }
}

