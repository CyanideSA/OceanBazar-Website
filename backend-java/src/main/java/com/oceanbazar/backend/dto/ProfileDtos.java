package com.oceanbazar.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

public class ProfileDtos {

    @Data
    public static class ProfileResponseDto {
        private String id;
        private String name;
        private String email;
        private String role;
        private String userType;
        private String phone;
        private String address;
        private String dateOfBirth;
        private String preferredPaymentMethod;
        private String businessName;
        private String businessType;
        private String taxId;
        private String contactPerson;
        private String businessDescription;
        private String expectedVolume;
        private String profileImageUrl;
    }

    @Data
    public static class MyOrdersResponseDto {
        /** Same shape as {@code GET /api/orders} for consistency across clients. */
        private List<OrderDtos.OrderResponseDto> orders;
    }

    @Data
    public static class ReturnRequestResponseDto {
        private Boolean success;
        private String returnStatus;
        private String returnRequestId;
        private String disputeId;
    }
}

