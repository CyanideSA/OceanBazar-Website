package com.oceanbazar.backend.payments;

import com.oceanbazar.backend.entity.OrderEntity;

public interface PaymentGateway {
    /**
     * Normalized provider key expected from the frontend.
     * Examples: "bkash", "nagad"
     */
    String providerKey();

    /**
     * Applies a successful placeholder payment to the order.
     * Should set tracking/payment status fields only.
     */
    void applySuccessfulPlaceholderPayment(OrderEntity order);
}

