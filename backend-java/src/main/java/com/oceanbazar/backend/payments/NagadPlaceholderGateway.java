package com.oceanbazar.backend.payments;

import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.enums.PaymentStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class NagadPlaceholderGateway implements PaymentGateway {
    @Value("${nagad.api-key:}")
    private String apiKey;

    @Value("${nagad.app-secret:}")
    private String appSecret;

    @Override
    public String providerKey() {
        return "nagad";
    }

    @Override
    public void applySuccessfulPlaceholderPayment(OrderEntity order) {
        if (order.getTrackingNumber() == null || order.getTrackingNumber().isBlank()) {
            order.setTrackingNumber("NAGAD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        }
        // Placeholder gateways behave like successful payments for now.
        order.setPaymentStatus(PaymentStatus.paid);
    }
}

