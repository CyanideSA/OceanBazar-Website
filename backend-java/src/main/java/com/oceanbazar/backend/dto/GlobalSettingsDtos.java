package com.oceanbazar.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Admin API payloads for global storefront contact, social, and merchandising settings.
 */
public class GlobalSettingsDtos {

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UpdateRequest {
        /** Empty string clears to blank; null leaves field unchanged on server. */
        @Size(max = 200)
        @Email(message = "Invalid email address")
        private String supportEmail;

        @Size(max = 80)
        private String supportPhone;

        @Size(max = 500)
        private String facebookUrl;

        @Size(max = 500)
        private String twitterUrl;

        @Size(max = 500)
        private String instagramUrl;

        @Size(max = 500)
        private String youtubeUrl;

        /** Non-null replace entire list on server. */
        private List<Map<String, Object>> heroSlides;
        private List<Map<String, Object>> productBanners;
        private List<String> featuredProductIds;
        private List<String> bestDealsProductIds;
        private List<String> newArrivalsProductIds;
        private List<Map<String, Object>> testimonials;
        private List<Map<String, Object>> trustBadges;
        private Integer defaultBannerRotationMs;
        private Integer testimonialCarouselMs;

        @Size(max = 200)
        private String sslcommerzStoreId;
        @Size(max = 500)
        private String sslcommerzStorePassword;
        @Size(max = 200)
        private String pathaoClientId;
        @Size(max = 500)
        private String pathaoClientSecret;
        @Size(max = 500)
        private String steadfastApiKey;
        @Size(max = 500)
        private String redxApiKey;
    }
}
