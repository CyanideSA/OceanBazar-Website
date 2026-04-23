package com.oceanbazar.backend.payments;

import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.enums.PaymentStatus;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class GenericPlaceholderGateway implements PaymentGateway {
    @Override
    public String providerKey() {
        return "placeholder";
    }

    @Override
    public void applySuccessfulPlaceholderPayment(OrderEntity order) {
        if (order.getTrackingNumber() == null || order.getTrackingNumber().isBlank()) {
            order.setTrackingNumber("TRK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        }
        // Placeholder gateways behave like successful payments for now.
        // PaymentTransaction will store a normalized status (pending/paid/failed) for ledger tracking.
        order.setPaymentStatus(PaymentStatus.paid);
    }
}

