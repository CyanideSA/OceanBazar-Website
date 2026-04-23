package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

@Entity @Table(name = "site_settings")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SiteSettingsEntity {
    public static final String GLOBAL_ID = "global";

    @Id
    private String id;

    @Column(name = "support_email")
    private String supportEmail;

    @Column(name = "support_phone")
    private String supportPhone;

    @Column(name = "facebook_url")
    private String facebookUrl;

    @Column(name = "twitter_url")
    private String twitterUrl;

    @Column(name = "instagram_url")
    private String instagramUrl;

    @Column(name = "youtube_url")
    private String youtubeUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "hero_slides", columnDefinition = "jsonb")
    private String heroSlides;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "product_banners", columnDefinition = "jsonb")
    private String productBanners;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "featured_product_ids", columnDefinition = "jsonb")
    private String featuredProductIds;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "best_deals_product_ids", columnDefinition = "jsonb")
    private String bestDealsProductIds;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_arrivals_product_ids", columnDefinition = "jsonb")
    private String newArrivalsProductIds;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "testimonials", columnDefinition = "jsonb")
    private String testimonials;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "trust_badges", columnDefinition = "jsonb")
    private String trustBadges;

    @Column(name = "default_banner_rotation_ms")
    private Integer defaultBannerRotationMs;

    @Column(name = "testimonial_carousel_ms")
    private Integer testimonialCarouselMs;

    @Column(name = "sslcommerz_store_id")
    private String sslcommerzStoreId;

    @Column(name = "sslcommerz_store_password")
    private String sslcommerzStorePassword;

    @Column(name = "pathao_client_id")
    private String pathaoClientId;

    @Column(name = "pathao_client_secret")
    private String pathaoClientSecret;

    @Column(name = "steadfast_api_key")
    private String steadfastApiKey;

    @Column(name = "redx_api_key")
    private String redxApiKey;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() {
        if (id == null) id = GLOBAL_ID;
        if (updatedAt == null) updatedAt = Instant.now();
        if (defaultBannerRotationMs == null) defaultBannerRotationMs = 6000;
    }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
