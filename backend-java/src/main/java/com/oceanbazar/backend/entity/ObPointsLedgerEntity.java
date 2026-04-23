package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.ObPointsType;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "ob_points_ledger")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ObPointsLedgerEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id", columnDefinition = "char(8)", nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ObPointsType type;

    @Column(nullable = false)
    private Integer points;

    @Column(name = "order_id", columnDefinition = "char(8)")
    private String orderId;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}
