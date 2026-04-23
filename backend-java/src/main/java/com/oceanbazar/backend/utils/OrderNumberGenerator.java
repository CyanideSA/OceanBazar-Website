package com.oceanbazar.backend.utils;

import java.security.SecureRandom;

/**
 * Human-friendly order reference: 8 uppercase hexadecimal characters (4 random bytes).
 */
public final class OrderNumberGenerator {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] HEX = "0123456789ABCDEF".toCharArray();

    private OrderNumberGenerator() {}

    public static String nextOrderNumber() {
        byte[] b = new byte[4];
        RANDOM.nextBytes(b);
        StringBuilder sb = new StringBuilder(8);
        for (byte value : b) {
            sb.append(HEX[(value & 0xF0) >> 4]);
            sb.append(HEX[value & 0x0F]);
        }
        return sb.toString();
    }
}
