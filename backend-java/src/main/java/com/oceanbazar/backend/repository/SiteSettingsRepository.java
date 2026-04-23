package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.SiteSettingsEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteSettingsRepository extends JpaRepository<SiteSettingsEntity, String> {
}
