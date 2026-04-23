package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "saved_addresses")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SavedAddressEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id", columnDefinition = "char(8)", nullable = false)
    private String userId;

    @Column(length = 100, nullable = false)
    private String label;

    @Column(nullable = false)
    private String line1;

    private String line2;

    @Column(length = 100, nullable = false)
    private String city;

    @Column(length = 100, nullable = false)
    private String district;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    @Column(name = "is_default", nullable = false)
    private Boolean isDefault;

    @PrePersist void prePersist() { if (isDefault == null) isDefault = false; }
}
