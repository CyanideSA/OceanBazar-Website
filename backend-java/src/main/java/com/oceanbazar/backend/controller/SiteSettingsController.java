package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.SiteSettingsEntity;
import com.oceanbazar.backend.service.SiteSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/site-settings")
@RequiredArgsConstructor
public class SiteSettingsController {
    private final SiteSettingsService siteSettingsService;

    /**
     * Public contact + social URLs. Never throws: service falls back to defaults if Mongo is unavailable.
     */
    @GetMapping
    public Map<String, Object> getPublicSettings() {
        SiteSettingsEntity s = siteSettingsService.getOrCreate();
        return siteSettingsService.toPublicMap(s);
    }
}
