package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "inventory_transactions")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class InventoryTransactionEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "inventory_item_id", nullable = false)
    private String inventoryItemId;

    @Column(name = "product_id", nullable = false)
    private String productId;

    @Column(name = "variant_id")
    private String variantId;

    @Column(name = "order_id")
    private String orderId;

    @Column(length = 30, nullable = false)
    private String type;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "previous_on_hand")
    private Integer previousOnHand;

    @Column(name = "new_on_hand")
    private Integer newOnHand;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "actor_id")
    private String actorId;

    @Column(name = "actor_type", length = 20)
    private String actorType;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}
