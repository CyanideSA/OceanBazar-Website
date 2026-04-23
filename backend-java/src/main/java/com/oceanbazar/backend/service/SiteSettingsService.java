package com.oceanbazar.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oceanbazar.backend.dto.GlobalSettingsDtos;
import com.oceanbazar.backend.entity.SiteSettingsEntity;
import com.oceanbazar.backend.repository.SiteSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SiteSettingsService {

    private static final TypeReference<List<Map<String, Object>>> MAP_LIST_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {};

    private final SiteSettingsRepository siteSettingsRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public SiteSettingsEntity getOrCreate() {
        return siteSettingsRepository.findById(SiteSettingsEntity.GLOBAL_ID)
                .orElseGet(() -> {
                    SiteSettingsEntity defaults = SiteSettingsEntity.builder()
                            .id(SiteSettingsEntity.GLOBAL_ID)
                            .supportEmail("")
                            .supportPhone("")
                            .facebookUrl("")
                            .twitterUrl("")
                            .instagramUrl("")
                            .youtubeUrl("")
                            .heroSlides("[]")
                            .productBanners("[]")
                            .featuredProductIds("[]")
                            .bestDealsProductIds("[]")
                            .newArrivalsProductIds("[]")
                            .testimonials("[]")
                            .trustBadges("[]")
                            .defaultBannerRotationMs(6000)
                            .sslcommerzStoreId("")
                            .sslcommerzStorePassword("")
                            .pathaoClientId("")
                            .pathaoClientSecret("")
                            .steadfastApiKey("")
                            .redxApiKey("")
                            .updatedAt(Instant.now())
                            .build();
                    return siteSettingsRepository.save(defaults);
                });
    }

    public Map<String, Object> toPublicMap(SiteSettingsEntity s) {
        SiteSettingsEntity base = s != null ? s : getOrCreate();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("supportEmail", blankToNull(base.getSupportEmail()));
        m.put("supportPhone", blankToNull(base.getSupportPhone()));
        m.put("facebookUrl", blankToNull(base.getFacebookUrl()));
        m.put("twitterUrl", blankToNull(base.getTwitterUrl()));
        m.put("instagramUrl", blankToNull(base.getInstagramUrl()));
        m.put("youtubeUrl", blankToNull(base.getYoutubeUrl()));
        m.put("heroSlides", parseJsonMapList(base.getHeroSlides()));
        m.put("productBanners", parseJsonMapList(base.getProductBanners()));
        m.put("featuredProductIds", parseJsonStringList(base.getFeaturedProductIds()));
        m.put("bestDealsProductIds", parseJsonStringList(base.getBestDealsProductIds()));
        m.put("newArrivalsProductIds", parseJsonStringList(base.getNewArrivalsProductIds()));
        m.put("testimonials", parseJsonMapList(base.getTestimonials()));
        m.put("trustBadges", parseJsonMapList(base.getTrustBadges()));
        int defaultMs = base.getDefaultBannerRotationMs() == null ? 6000 : base.getDefaultBannerRotationMs();
        m.put("defaultBannerRotationMs", defaultMs);
        Integer rawTestimonial = base.getTestimonialCarouselMs();
        int testimonialMs = (rawTestimonial == null || rawTestimonial <= 0) ? defaultMs : rawTestimonial;
        m.put("testimonialCarouselMs", testimonialMs);
        Instant updated = base.getUpdatedAt() != null ? base.getUpdatedAt() : Instant.now();
        m.put("updatedAt", Date.from(updated));
        return m;
    }

    public Map<String, Object> toAdminMap(SiteSettingsEntity s) {
        Map<String, Object> m = new LinkedHashMap<>(toPublicMap(s));
        SiteSettingsEntity base = s != null ? s : getOrCreate();
        m.put("sslcommerzStoreId", nz(base.getSslcommerzStoreId()));
        m.put("sslcommerzStorePassword", nz(base.getSslcommerzStorePassword()));
        m.put("pathaoClientId", nz(base.getPathaoClientId()));
        m.put("pathaoClientSecret", nz(base.getPathaoClientSecret()));
        m.put("steadfastApiKey", nz(base.getSteadfastApiKey()));
        m.put("redxApiKey", nz(base.getRedxApiKey()));
        return m;
    }

    @Transactional
    public SiteSettingsEntity applyAdminUpdate(GlobalSettingsDtos.UpdateRequest req) {
        SiteSettingsEntity s = getOrCreate();
        if (req.getSupportEmail() != null) {
            s.setSupportEmail(req.getSupportEmail().trim());
        }
        if (req.getSupportPhone() != null) {
            s.setSupportPhone(req.getSupportPhone().trim());
        }
        if (req.getFacebookUrl() != null) {
            s.setFacebookUrl(req.getFacebookUrl().trim());
        }
        if (req.getTwitterUrl() != null) {
            s.setTwitterUrl(req.getTwitterUrl().trim());
        }
        if (req.getInstagramUrl() != null) {
            s.setInstagramUrl(req.getInstagramUrl().trim());
        }
        if (req.getYoutubeUrl() != null) {
            s.setYoutubeUrl(req.getYoutubeUrl().trim());
        }
        if (req.getHeroSlides() != null) {
            s.setHeroSlides(toJson(req.getHeroSlides()));
        }
        if (req.getProductBanners() != null) {
            s.setProductBanners(toJson(req.getProductBanners()));
        }
        if (req.getFeaturedProductIds() != null) {
            s.setFeaturedProductIds(toJson(req.getFeaturedProductIds()));
        }
        if (req.getBestDealsProductIds() != null) {
            s.setBestDealsProductIds(toJson(req.getBestDealsProductIds()));
        }
        if (req.getNewArrivalsProductIds() != null) {
            s.setNewArrivalsProductIds(toJson(req.getNewArrivalsProductIds()));
        }
        if (req.getTestimonials() != null) {
            s.setTestimonials(toJson(req.getTestimonials()));
        }
        if (req.getTrustBadges() != null) {
            s.setTrustBadges(toJson(req.getTrustBadges()));
        }
        if (req.getDefaultBannerRotationMs() != null && req.getDefaultBannerRotationMs() > 0) {
            s.setDefaultBannerRotationMs(req.getDefaultBannerRotationMs());
        }
        if (req.getTestimonialCarouselMs() != null) {
            int v = req.getTestimonialCarouselMs();
            s.setTestimonialCarouselMs(v <= 0 ? null : v);
        }
        if (req.getSslcommerzStoreId() != null) {
            s.setSslcommerzStoreId(req.getSslcommerzStoreId().trim());
        }
        if (req.getSslcommerzStorePassword() != null) {
            s.setSslcommerzStorePassword(req.getSslcommerzStorePassword().trim());
        }
        if (req.getPathaoClientId() != null) {
            s.setPathaoClientId(req.getPathaoClientId().trim());
        }
        if (req.getPathaoClientSecret() != null) {
            s.setPathaoClientSecret(req.getPathaoClientSecret().trim());
        }
        if (req.getSteadfastApiKey() != null) {
            s.setSteadfastApiKey(req.getSteadfastApiKey().trim());
        }
        if (req.getRedxApiKey() != null) {
            s.setRedxApiKey(req.getRedxApiKey().trim());
        }
        s.setUpdatedAt(Instant.now());
        return siteSettingsRepository.save(s);
    }

    private List<Map<String, Object>> parseJsonMapList(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, MAP_LIST_TYPE);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse JSON map list: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private List<String> parseJsonStringList(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, STRING_LIST_TYPE);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse JSON string list: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private String toJson(Object obj) {
        if (obj == null) return "[]";
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize to JSON: {}", e.getMessage());
            return "[]";
        }
    }

    private static String nz(String v) {
        return v == null ? "" : v;
    }

    private static String blankToNull(String v) {
        if (v == null || v.isBlank()) return null;
        return v.trim();
    }
}
