package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.TagGroupEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TagGroupRepository extends JpaRepository<TagGroupEntity, Integer> {
    Optional<TagGroupEntity> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
