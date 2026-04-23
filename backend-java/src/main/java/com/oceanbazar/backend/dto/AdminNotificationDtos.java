package com.oceanbazar.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class AdminNotificationDtos {
    @Data
    public static class CreateNotificationRequest {
        @NotBlank
        @Size(max = 120)
        private String title;

        @NotBlank
        @Size(max = 1000)
        private String message;

        private String audience;
        private String userId;
    }

    /** Push one stored notification per active customer; real-time via existing STOMP/SSE paths. */
    @Data
    public static class BroadcastToCustomersRequest {
        @NotBlank
        @Size(max = 120)
        private String title;

        @NotBlank
        @Size(max = 2000)
        private String message;

        @Size(max = 2048)
        private String image;
    }
}

