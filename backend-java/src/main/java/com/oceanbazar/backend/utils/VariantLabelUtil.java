package com.oceanbazar.backend.utils;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oceanbazar.backend.entity.ProductVariantEntity;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Human-readable variant option labels for cart, checkout, invoice, CRM. */
public final class VariantLabelUtil {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private VariantLabelUtil() {}

    public static Map<String, String> parseAttributes(String rawJson) {
        if (rawJson == null || rawJson.isBlank()) return Map.of();
        try {
            Map<String, Object> raw = MAPPER.readValue(rawJson, MAP_TYPE);
            Map<String, String> out = new LinkedHashMap<>();
            for (Map.Entry<String, Object> e : raw.entrySet()) {
                if (e.getKey() == null || e.getKey().startsWith("_")) continue;
                if (e.getValue() == null) continue;
                String v = String.valueOf(e.getValue()).trim();
                if (!v.isEmpty()) out.put(e.getKey(), v);
            }
            return out;
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    public static String formatLabel(ProductVariantEntity variant) {
        if (variant == null) return null;
        Map<String, String> attrs = parseAttributes(variant.getAttributes());
        List<String> parts = new ArrayList<>();
        appendAxis(parts, attrs, List.of("color", "colour", "shade", "কালার", "শতাদ"), "Color");
        appendAxis(parts, attrs, List.of("size", "সাইজ"), "Size");
        appendAxis(parts, attrs, List.of("style", "finish", "type", "option", "স্টাইল"), "Style");
        // Any remaining axes (custom option keys)
        for (Map.Entry<String, String> e : attrs.entrySet()) {
            String key = e.getKey().toLowerCase(Locale.ROOT);
            if (key.equals("color") || key.equals("colour") || key.equals("shade")
                    || key.equals("size") || key.equals("style") || key.equals("finish")
                    || key.equals("type") || key.equals("option")
                    || key.equals("কালার") || key.equals("সাইজ") || key.equals("স্টাইল") || key.equals("শতাদ")) {
                continue;
            }
            parts.add(capitalize(e.getKey()) + ": " + e.getValue());
        }
        if (!parts.isEmpty()) return String.join(" · ", parts);
        if (variant.getNameEn() != null && !variant.getNameEn().isBlank()) return variant.getNameEn().trim();
        return null;
    }

    public static String titledProduct(String productTitle, ProductVariantEntity variant) {
        String base = productTitle == null || productTitle.isBlank() ? "Product" : productTitle.trim();
        String label = formatLabel(variant);
        if (label == null || label.isBlank()) return base;
        if (base.contains(label)) return base;
        return base + " · " + label;
    }

    private static void appendAxis(List<String> parts, Map<String, String> attrs, List<String> keys, String label) {
        for (String k : keys) {
            for (Map.Entry<String, String> e : attrs.entrySet()) {
                if (e.getKey().equalsIgnoreCase(k)) {
                    parts.add(label + ": " + e.getValue());
                    return;
                }
            }
        }
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
