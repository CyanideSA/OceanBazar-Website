package com.oceanbazar.backend.entity.enums;

import java.util.Locale;
import java.util.Optional;
import java.util.Set;

public enum OrderStatus {
    pending, confirmed, processing, shipped, delivered, cancelled, returned;

    public String getWireValue() {
        return name();
    }

    public static Optional<OrderStatus> tryParse(Object status) {
        if (status == null) {
            return Optional.empty();
        }
        if (status instanceof OrderStatus os) {
            return Optional.of(os);
        }
        String s = status.toString().trim().toLowerCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        try {
            return Optional.of(OrderStatus.valueOf(s));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public static Set<String> pipelineWireValues() {
        return Set.of(pending.name(), confirmed.name(), processing.name());
    }
}
