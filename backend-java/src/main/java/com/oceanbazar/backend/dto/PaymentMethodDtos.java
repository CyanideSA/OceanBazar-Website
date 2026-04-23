package com.oceanbazar.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Date;

public class PaymentMethodDtos {

    @Data
    public static class CreateRequest {
        @NotBlank
        private String type;

        @Size(max = 60)
        private String nickname;

        @Size(max = 40)
        private String cardBrand;

        @Size(max = 4)
        private String last4;

        private Integer expiryMonth;
        private Integer expiryYear;

        @Size(max = 24)
        private String walletProvider;

        @Size(max = 4)
        private String walletLast4;

        @Size(max = 80)
        private String bankName;

        @Size(max = 4)
        private String bankAccountLast4;

        private Boolean setAsDefault;
    }

    @Data
    public static class ListResponse {
        private java.util.List<PaymentMethodResponse> paymentMethods;
    }

    @Data
    public static class PaymentMethodResponse {
        private String id;
        private String type;
        private String nickname;
        private String displaySummary;
        private String cardBrand;
        private String last4;
        private Integer expiryMonth;
        private Integer expiryYear;
        private String walletProvider;
        private String walletLast4;
        private String bankName;
        private String bankAccountLast4;
        private boolean defaultMethod;
        private Date createdAt;
    }
}
