package com.oceanbazar.backend.payments;

import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.enums.PaymentStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Placeholder for SSLCOMMERZ integration. Wire real API calls using
 * {@code sslcommerz.store-id}, {@code sslcommerz.store-password}, etc. when ready.
 */
@Component
@RequiredArgsConstructor
public class SslCommerzPlaceholderGateway implements PaymentGateway {

    @Value("${sslcommerz.store-id:}")
    private String storeId;

    @Value("${sslcommerz.store-password:}")
    private String storePassword;

    @Override
    public String providerKey() {
        return "sslcommerz";
    }

    @Override
    public void applySuccessfulPlaceholderPayment(OrderEntity order) {
        if (order.getTrackingNumber() == null || order.getTrackingNumber().isBlank()) {
            order.setTrackingNumber("SSLC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        }
        order.setPaymentStatus(PaymentStatus.paid);
    }
}
