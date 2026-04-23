package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "warehouses")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class WarehouseEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(unique = true)
    private String code;

    @Column(columnDefinition = "jsonb")
    private String address;

    @Column(name = "contact_phone")
    private String contactPhone;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(nullable = false)
    private Boolean active;

    @Column(name = "is_primary", nullable = false)
    private Boolean isPrimary;

    @Column(name = "supported_carriers", columnDefinition = "jsonb")
    private String supportedCarriers;

    @Column(name = "operating_hours", columnDefinition = "jsonb")
    private String operatingHours;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() { Instant n = Instant.now(); if (createdAt == null) createdAt = n; if (updatedAt == null) updatedAt = n; if (active == null) active = true; if (isPrimary == null) isPrimary = false; }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
