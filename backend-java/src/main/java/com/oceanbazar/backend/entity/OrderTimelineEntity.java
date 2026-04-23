package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.ActorType;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "order_timeline")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class OrderTimelineEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "order_id", columnDefinition = "char(8)", nullable = false)
    private String orderId;

    @Column(length = 100, nullable = false)
    private String status;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "actor_id", length = 50)
    private String actorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "actor_type", nullable = false)
    private ActorType actorType;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}
