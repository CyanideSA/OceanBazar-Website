package com.oceanbazar.backend.utils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Normalizes product media URLs so they work in {@code <img src>}.
 * Google Drive "anyone with the link" pages are HTML, not images — convert to {@code /uc?export=view&id=…}.
 */
public final class ProductUrlUtil {
    private static final Pattern DRIVE_FILE_ID = Pattern.compile("/file/d/([a-zA-Z0-9_-]+)");
    private static final Pattern OPEN_ID = Pattern.compile("[?&]id=([a-zA-Z0-9_-]+)");

    private ProductUrlUtil() {}

    public static String normalizeProductImageUrl(String raw) {
        if (raw == null) return null;
        String url = raw.trim();
        if (url.isEmpty()) return url;

        String lower = url.toLowerCase();
        if (lower.contains("drive.google.com") || lower.contains("docs.google.com")) {
            String id = extractDriveFileId(url);
            if (id != null && !id.isBlank()) {
                return "https://drive.google.com/uc?export=view&id=" + id;
            }
        }
        return url;
    }

    private static String extractDriveFileId(String url) {
        Matcher m = DRIVE_FILE_ID.matcher(url);
        if (m.find()) return m.group(1);
        Matcher m2 = OPEN_ID.matcher(url);
        if (m2.find()) return m2.group(1);
        return null;
    }
}
