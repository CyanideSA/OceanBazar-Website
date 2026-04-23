package com.oceanbazar.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class ReviewDtos {

    @Data
    public static class SubmitReviewRequest {
        @NotBlank
        @Size(max = 64)
        private String productId;

        @NotNull
        @Min(1)
        @Max(5)
        private Integer rating;

        @Size(max = 120)
        private String title;

        @NotBlank
        @Size(min = 3, max = 2000)
        private String comment;

        /** Optional — e.g. from “review after order” flow for future verified-purchase checks. */
        @Size(max = 64)
        private String orderId;
    }
}
