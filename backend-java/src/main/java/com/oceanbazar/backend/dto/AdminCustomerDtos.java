package com.oceanbazar.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class AdminCustomerDtos {

    /**
     * Contact/profile fields admins may edit (not email, role, or wholesale flags).
     */
    @Data
    public static class AdminCustomerProfileUpdateRequest {
        @NotBlank(message = "Name is required")
        @Size(max = 200, message = "Name must be at most 200 characters")
        private String name;

        @Size(max = 40, message = "Phone must be at most 40 characters")
        private String phone;

        @Size(max = 2000, message = "Address must be at most 2000 characters")
        private String address;
    }
}
