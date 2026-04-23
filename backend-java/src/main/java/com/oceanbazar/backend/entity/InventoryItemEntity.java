package com.oceanbazar.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "inventory_items")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class InventoryItemEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "product_id", nullable = false)
    private String productId;

    @Column(name = "variant_id")
    private String variantId;

    private String sku;

    @Column(name = "warehouse_id")
    private String warehouseId;

    @Column(name = "warehouse_name")
    private String warehouseName;

    @Column(name = "quantity_on_hand", nullable = false)
    private Integer quantityOnHand;

    @Column(name = "quantity_reserved", nullable = false)
    private Integer quantityReserved;

    @Column(name = "quantity_available", nullable = false)
    private Integer quantityAvailable;

    @Column(name = "reorder_point", nullable = false)
    private Integer reorderPoint;

    @Column(name = "reorder_quantity", nullable = false)
    private Integer reorderQuantity;

    @Column(length = 20, nullable = false)
    private String status;

    @Column(name = "last_restocked_at", columnDefinition = "timestamptz")
    private Instant lastRestockedAt;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @PrePersist void prePersist() {
        Instant n = Instant.now();
        if (createdAt == null) createdAt = n;
        if (updatedAt == null) updatedAt = n;
        if (quantityOnHand == null) quantityOnHand = 0;
        if (quantityReserved == null) quantityReserved = 0;
        if (quantityAvailable == null) quantityAvailable = 0;
        if (reorderPoint == null) reorderPoint = 10;
        if (reorderQuantity == null) reorderQuantity = 50;
        if (status == null) status = "in_stock";
    }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }

    public void recalculateAvailable() {
        int onHand = this.quantityOnHand != null ? this.quantityOnHand : 0;
        int reserved = this.quantityReserved != null ? this.quantityReserved : 0;
        int reorder = this.reorderPoint != null ? this.reorderPoint : 10;
        this.quantityAvailable = Math.max(0, onHand - reserved);
        if (this.quantityAvailable <= 0) this.status = "out_of_stock";
        else if (this.quantityAvailable <= reorder) this.status = "low_stock";
        else this.status = "in_stock";
    }
}
