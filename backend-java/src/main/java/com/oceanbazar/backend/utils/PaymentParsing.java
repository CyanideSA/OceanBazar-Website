package com.oceanbazar.backend.utils;

import com.oceanbazar.backend.entity.enums.PaymentMethod;
import com.oceanbazar.backend.entity.enums.PaymentStatus;

import java.util.Locale;

public final class PaymentParsing {
    private PaymentParsing() {}

    public static PaymentMethod parsePaymentMethod(String raw) {
        if (raw == null || raw.isBlank()) {
            return PaymentMethod.cod;
        }
        String s = raw.trim().toLowerCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        if ("placeholder".equals(s) || "generic".equals(s)) {
            return PaymentMethod.sslcommerz;
        }
        try {
            return PaymentMethod.valueOf(s);
        } catch (IllegalArgumentException e) {
            return PaymentMethod.cod;
        }
    }

    /** Maps admin/API wire strings to persisted {@link PaymentStatus}. */
    public static PaymentStatus parseOrderPaymentStatusWire(String raw) {
        if (raw == null || raw.isBlank()) {
            return PaymentStatus.unpaid;
        }
        String s = raw.trim().toLowerCase(Locale.ROOT);
        return switch (s) {
            case "paid", "success" -> PaymentStatus.paid;
            case "refunded" -> PaymentStatus.refunded;
            case "partial" -> PaymentStatus.partial;
            default -> PaymentStatus.unpaid;
        };
    }
}
