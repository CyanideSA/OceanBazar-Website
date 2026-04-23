package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.CouponType;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity @Table(name = "coupons")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class CouponEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(length = 50, unique = true, nullable = false)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CouponType type;

    @Column(precision = 10, scale = 2, nullable = false)
    private BigDecimal value;

    @Column(name = "min_order", precision = 12, scale = 2, nullable = false)
    private BigDecimal minOrder;

    @Column(name = "max_uses")
    private Integer maxUses;

    @Column(name = "used_count", nullable = false)
    private Integer usedCount;

    @Column(name = "starts_at", columnDefinition = "timestamptz", nullable = false)
    private Instant startsAt;

    @Column(name = "expires_at", columnDefinition = "timestamptz")
    private Instant expiresAt;

    @Column(nullable = false)
    private Boolean active;

    @PrePersist void prePersist() { if (minOrder == null) minOrder = BigDecimal.ZERO; if (usedCount == null) usedCount = 0; if (active == null) active = true; }
}
