package com.oceanbazar.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.oceanbazar.backend.entity.enums.*;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Entity @Table(name = "orders")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class OrderEntity {
    @Id @Column(columnDefinition = "char(8)")
    private String id;

    @Column(name = "order_number", length = 20, unique = true, nullable = false)
    private String orderNumber;

    @Column(name = "user_id", columnDefinition = "char(8)", nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "customer_type", nullable = false)
    private CustomerType customerType;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal subtotal;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal discount;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal gst;

    @Column(name = "shipping_fee", precision = 12, scale = 2, nullable = false)
    private BigDecimal shippingFee;

    @Column(name = "service_fee", precision = 12, scale = 2, nullable = false)
    private BigDecimal serviceFee;

    @Column(name = "ob_points_used", nullable = false)
    private Integer obPointsUsed;

    @Column(name = "ob_discount", precision = 12, scale = 2, nullable = false)
    private BigDecimal obDiscount;

    @Column(name = "coupon_id")
    private Integer couponId;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false)
    private PaymentStatus paymentStatus;

    @Column(name = "shipping_address_id")
    private Integer shippingAddressId;

    @Column(name = "tracking_number", columnDefinition = "char(16)")
    private String trackingNumber;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "orderId", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<OrderItemEntity> items;

    @OneToMany(mappedBy = "orderId", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<OrderTimelineEntity> timeline;

    @PrePersist void prePersist() {
        Instant n = Instant.now();
        if (createdAt == null) createdAt = n;
        if (updatedAt == null) updatedAt = n;
        if (status == null) status = OrderStatus.pending;
        if (paymentStatus == null) paymentStatus = PaymentStatus.unpaid;
        if (discount == null) discount = BigDecimal.ZERO;
        if (obPointsUsed == null) obPointsUsed = 0;
        if (obDiscount == null) obDiscount = BigDecimal.ZERO;
    }
    @PreUpdate void preUpdate() { updatedAt = Instant.now(); }
}
