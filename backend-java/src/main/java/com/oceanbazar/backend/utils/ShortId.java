package com.oceanbazar.backend.utils;

import java.util.UUID;

public final class ShortId {
    private ShortId() {}

    /** 8-char uppercase hex id (matches {@code char(8)} columns). */
    public static String newId8() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }
}
