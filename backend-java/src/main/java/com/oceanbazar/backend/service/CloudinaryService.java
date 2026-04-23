package com.oceanbazar.backend.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CloudinaryService {

    private final Cloudinary cloudinary;

    private boolean isConfigured() {
        Object cloudName = cloudinary.config.cloudName;
        return cloudName != null && !cloudName.toString().isBlank();
    }

    /**
     * Upload a file to Cloudinary.
     *
     * @param file   The multipart file
     * @param folder The Cloudinary folder (e.g., "products", "banners")
     * @param tags   Optional comma-separated tags
     * @return Map with url, publicId, format, width, height, bytes, resourceType
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> upload(MultipartFile file, String folder, String tags) {
        if (!isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty");
        }

        try {
            Map<String, Object> options = new HashMap<>();
            if (folder != null && !folder.isBlank()) {
                options.put("folder", "oceanbazar/" + folder.trim());
            } else {
                options.put("folder", "oceanbazar/general");
            }
            if (tags != null && !tags.isBlank()) {
                options.put("tags", tags.trim());
            }
            options.put("resource_type", "auto");
            options.put("unique_filename", true);
            options.put("overwrite", false);

            Map<String, Object> result = cloudinary.uploader().upload(file.getBytes(), options);

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("url", result.get("secure_url"));
            out.put("publicId", result.get("public_id"));
            out.put("format", result.get("format"));
            out.put("width", result.get("width"));
            out.put("height", result.get("height"));
            out.put("bytes", result.get("bytes"));
            out.put("resourceType", result.get("resource_type"));
            out.put("originalFilename", result.get("original_filename"));
            out.put("createdAt", result.get("created_at"));
            return out;
        } catch (IOException e) {
            log.error("Cloudinary upload failed: {}", e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Upload failed: " + e.getMessage());
        }
    }

    /**
     * Upload multiple files.
     */
    public List<Map<String, Object>> uploadMultiple(List<MultipartFile> files, String folder, String tags) {
        return files.stream()
                .filter(f -> f != null && !f.isEmpty())
                .map(f -> upload(f, folder, tags))
                .collect(Collectors.toList());
    }

    /**
     * Delete a resource by publicId.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> delete(String publicId, String resourceType) {
        if (!isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Cloudinary is not configured");
        }
        if (publicId == null || publicId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "publicId is required");
        }
        try {
            Map<String, Object> options = new HashMap<>();
            options.put("resource_type", resourceType != null ? resourceType : "image");
            Map<String, Object> result = cloudinary.uploader().destroy(publicId.trim(), options);
            return Map.of("success", true, "result", result.getOrDefault("result", "unknown"));
        } catch (IOException e) {
            log.error("Cloudinary delete failed for {}: {}", publicId, e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Delete failed");
        }
    }

    /**
     * List resources in a folder.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> listResources(String folder, String resourceType, String nextCursor, int maxResults) {
        if (!isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Cloudinary is not configured");
        }
        try {
            Map<String, Object> options = new HashMap<>();
            options.put("type", "upload");
            options.put("resource_type", resourceType != null ? resourceType : "image");
            options.put("max_results", Math.min(maxResults, 100));
            if (folder != null && !folder.isBlank()) {
                options.put("prefix", "oceanbazar/" + folder.trim());
            } else {
                options.put("prefix", "oceanbazar/");
            }
            if (nextCursor != null && !nextCursor.isBlank()) {
                options.put("next_cursor", nextCursor.trim());
            }

            Map<String, Object> result = cloudinary.api().resources(options);

            List<Map<String, Object>> resources = ((List<Map<String, Object>>) result.getOrDefault("resources", List.of()))
                    .stream().map(r -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("publicId", r.get("public_id"));
                        m.put("url", r.get("secure_url"));
                        m.put("format", r.get("format"));
                        m.put("width", r.get("width"));
                        m.put("height", r.get("height"));
                        m.put("bytes", r.get("bytes"));
                        m.put("resourceType", r.get("resource_type"));
                        m.put("createdAt", r.get("created_at"));
                        return m;
                    }).toList();

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("resources", resources);
            out.put("nextCursor", result.get("next_cursor"));
            out.put("totalCount", result.get("total_count"));
            return out;
        } catch (Exception e) {
            log.error("Cloudinary list failed: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "List failed: " + e.getMessage());
        }
    }

    /**
     * Generate a transformation URL.
     */
    public String transformUrl(String publicId, int width, int height, String crop) {
        if (!isConfigured() || publicId == null || publicId.isBlank()) return "";
        return cloudinary.url()
                .transformation(new com.cloudinary.Transformation<>()
                        .width(width > 0 ? width : 800)
                        .height(height > 0 ? height : 800)
                        .crop(crop != null && !crop.isBlank() ? crop : "fill")
                        .quality("auto")
                        .fetchFormat("auto"))
                .secure(true)
                .generate(publicId.trim());
    }

    /**
     * Rename / move a resource.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> rename(String fromPublicId, String toPublicId) {
        if (!isConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Cloudinary is not configured");
        try {
            Map<String, Object> result = cloudinary.uploader().rename(fromPublicId, toPublicId, ObjectUtils.emptyMap());
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("url", result.get("secure_url"));
            out.put("publicId", result.get("public_id"));
            return out;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Rename failed: " + e.getMessage());
        }
    }
}
