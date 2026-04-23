package com.oceanbazar.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class AuthDtos {

    @Data
    public static class UserSignupRequest {
        @NotBlank
        @Size(min = 2, max = 100)
        private String name;
        @Email
        private String email;
        @NotBlank
        @Size(min = 8)
        private String password;
        private String phone;
        private String userType;
    }

    /**
     * Accepts either email or phone in the {@code identifier} field,
     * plus a legacy {@code email} field for backwards compatibility.
     */
    @Data
    public static class UserLoginRequest {
        private String identifier;
        private String email;
        private String phone;
        @NotBlank
        private String password;

        public String resolveIdentifier() {
            if (identifier != null && !identifier.isBlank()) return identifier.trim();
            if (email != null && !email.isBlank()) return email.trim();
            if (phone != null && !phone.isBlank()) return phone.trim();
            return null;
        }
    }

    /** Register endpoint DTO — mirrors signup but with separate register path */
    @Data
    public static class UserRegisterRequest {
        @NotBlank
        @Size(min = 2, max = 100)
        private String name;
        @Email
        private String email;
        @NotBlank
        @Size(min = 8)
        private String password;
        private String phone;
        private String userType;
    }

    @Data
    public static class ResetPasswordRequest {
        @NotBlank
        private String target;
        @NotBlank
        private String otp;
        @NotBlank
        @Size(min = 8)
        private String newPassword;
    }

    @Data
    public static class OtpSendRequest {
        @NotBlank
        private String target;
        private String type;
    }

    @Data
    public static class OtpVerifyRequest {
        @NotBlank
        private String target;
        @NotBlank
        private String code;
    }

    @Data
    public static class ForgotPasswordRequest {
        private String email;
        private String target;

        public String resolveTarget() {
            if (target != null && !target.isBlank()) return target.trim();
            return email != null ? email.trim() : null;
        }
    }

    @Data
    public static class UserResponse {
        private String id;
        private String name;
        private String email;
        private String role = "retail";
        private String userType = "retail";
        private String profileImageUrl;
        private Boolean emailVerified;
    }

    @Data
    public static class ChangePasswordRequest {
        @NotBlank
        private String currentPassword;
        @NotBlank
        @Size(min = 8)
        private String newPassword;
    }

    @Data
    public static class TokenResponse {
        private UserResponse user;
        private String token;

        /** Alias so frontend {@code data.access} works alongside {@code data.token} */
        public String getAccess() {
            return token;
        }
    }
}
