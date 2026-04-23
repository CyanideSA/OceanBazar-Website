package com.oceanbazar.backend.payments;

import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.enums.PaymentStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class BkashPlaceholderGateway implements PaymentGateway {
    // Kept for real-gateway wiring later
    @Value("${bkash.api-key:}")
    private String apiKey;

    @Value("${bkash.app-secret:}")
    private String appSecret;

    @Override
    public String providerKey() {
        return "bkash";
    }

    @Override
    public void applySuccessfulPlaceholderPayment(OrderEntity order) {
        // Placeholder: set provider-specific tracking number prefix
        if (order.getTrackingNumber() == null || order.getTrackingNumber().isBlank()) {
            order.setTrackingNumber("BKASH-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        }
        // Placeholder gateways behave like successful payments for now.
        order.setPaymentStatus(PaymentStatus.paid);
    }
}

