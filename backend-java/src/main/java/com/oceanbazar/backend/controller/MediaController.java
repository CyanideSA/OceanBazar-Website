package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.service.CloudinaryService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/media")
@RequiredArgsConstructor
public class MediaController {

    private final CloudinaryService cloudinaryService;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF");

    private Claims requireAdmin(String authorization) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, R_ALL);
    }

    @PostMapping("/upload")
    public Map<String, Object> upload(
            @RequestHeader("Authorization") String authorization,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", required = false, defaultValue = "general") String folder,
            @RequestParam(value = "tags", required = false) String tags
    ) {
        requireAdmin(authorization);
        Map<String, Object> result = cloudinaryService.upload(file, folder, tags);
        return Map.of("success", true, "media", result);
    }

    @PostMapping("/upload-multiple")
    public Map<String, Object> uploadMultiple(
            @RequestHeader("Authorization") String authorization,
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(value = "folder", required = false, defaultValue = "general") String folder,
            @RequestParam(value = "tags", required = false) String tags
    ) {
        requireAdmin(authorization);
        if (files == null || files.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No files provided");
        }
        List<Map<String, Object>> results = cloudinaryService.uploadMultiple(files, folder, tags);
        return Map.of("success", true, "media", results, "count", results.size());
    }

    @DeleteMapping("/delete")
    public Map<String, Object> delete(
            @RequestHeader("Authorization") String authorization,
            @RequestParam("publicId") String publicId,
            @RequestParam(value = "resourceType", required = false, defaultValue = "image") String resourceType
    ) {
        requireAdmin(authorization);
        return cloudinaryService.delete(publicId, resourceType);
    }

    @GetMapping("/list")
    public Map<String, Object> list(
            @RequestHeader("Authorization") String authorization,
            @RequestParam(value = "folder", required = false) String folder,
            @RequestParam(value = "resourceType", required = false, defaultValue = "image") String resourceType,
            @RequestParam(value = "nextCursor", required = false) String nextCursor,
            @RequestParam(value = "maxResults", required = false, defaultValue = "30") int maxResults
    ) {
        requireAdmin(authorization);
        return cloudinaryService.listResources(folder, resourceType, nextCursor, maxResults);
    }

    @PostMapping("/transform-url")
    public Map<String, Object> transformUrl(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body
    ) {
        requireAdmin(authorization);
        String publicId = (String) body.get("publicId");
        int width = body.get("width") != null ? ((Number) body.get("width")).intValue() : 0;
        int height = body.get("height") != null ? ((Number) body.get("height")).intValue() : 0;
        String crop = (String) body.get("crop");
        String url = cloudinaryService.transformUrl(publicId, width, height, crop);
        return Map.of("url", url);
    }

    @PostMapping("/rename")
    public Map<String, Object> rename(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, String> body
    ) {
        requireAdmin(authorization);
        String from = body.get("fromPublicId");
        String to = body.get("toPublicId");
        if (from == null || to == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fromPublicId and toPublicId required");
        }
        return cloudinaryService.rename(from, to);
    }
}
