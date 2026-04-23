package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.ProductAssetEntity;
import com.oceanbazar.backend.entity.enums.AssetType;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.ProductAssetRepository;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.service.CloudinaryService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/api/admin/products/{productId}/assets")
@RequiredArgsConstructor
@Slf4j
public class AdminProductAssetController {
    private final ProductAssetRepository assetRepository;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;
    private final CloudinaryService cloudinaryService;

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");
    private static final Set<String> R_ADMIN_UP = Set.of("SUPER_ADMIN", "ADMIN");

    @GetMapping
    public List<ProductAssetEntity> list(@RequestHeader("Authorization") String auth, @PathVariable String productId) {
        requireAnyRole(auth, R_ALL);
        return assetRepository.findByProductIdOrderBySortOrderAsc(productId);
    }

    @PostMapping("/upload")
    public ProductAssetEntity upload(@RequestHeader("Authorization") String auth,
                                      @PathVariable String productId,
                                      @RequestParam("file") MultipartFile file,
                                      @RequestParam(defaultValue = "image") String assetType,
                                      @RequestParam(defaultValue = "false") boolean isPrimary) {
        requireAnyRole(auth, R_ADMIN_UP);
        if (file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty");

        // Upload to Cloudinary under products/{productId} folder
        String folder = "products/" + productId;
        Map<String, Object> result = cloudinaryService.upload(file, folder, "product," + productId);
        String url = (String) result.get("url");

        ProductAssetEntity asset = new ProductAssetEntity();
        asset.setProductId(productId);
        asset.setAssetType("video".equalsIgnoreCase(assetType) ? AssetType.video : AssetType.image);
        asset.setUrl(url);
        asset.setSortOrder(assetRepository.findByProductIdOrderBySortOrderAsc(productId).size());
        asset.setIsPrimary(isPrimary);
        asset.setFileSize(file.getSize());
        asset.setMimeType(file.getContentType());
        return assetRepository.save(asset);
    }

    @PutMapping("/{assetId}")
    public ProductAssetEntity update(@RequestHeader("Authorization") String auth,
                                      @PathVariable String productId,
                                      @PathVariable Integer assetId,
                                      @RequestBody Map<String, Object> body) {
        requireAnyRole(auth, R_ADMIN_UP);
        ProductAssetEntity asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset not found"));
        if (body.containsKey("altEn")) asset.setAltEn((String) body.get("altEn"));
        if (body.containsKey("altBn")) asset.setAltBn((String) body.get("altBn"));
        if (body.containsKey("sortOrder")) asset.setSortOrder(((Number) body.get("sortOrder")).intValue());
        if (body.containsKey("isPrimary")) asset.setIsPrimary((Boolean) body.get("isPrimary"));
        if (body.containsKey("colorKey")) asset.setColorKey((String) body.get("colorKey"));
        return assetRepository.save(asset);
    }

    @DeleteMapping("/{assetId}")
    public Map<String, Object> delete(@RequestHeader("Authorization") String auth,
                                       @PathVariable String productId,
                                       @PathVariable Integer assetId) {
        requireAnyRole(auth, R_ADMIN_UP);
        // Try to delete from Cloudinary if URL is a Cloudinary URL
        assetRepository.findById(assetId).ifPresent(asset -> {
            String url = asset.getUrl();
            if (url != null && url.contains("cloudinary.com")) {
                try {
                    // Extract publicId from Cloudinary URL
                    String publicId = extractCloudinaryPublicId(url);
                    String resourceType = asset.getAssetType() == AssetType.video ? "video" : "image";
                    if (publicId != null) {
                        cloudinaryService.delete(publicId, resourceType);
                    }
                } catch (Exception e) {
                    log.warn("Failed to delete Cloudinary asset {}: {}", assetId, e.getMessage());
                }
            }
        });
        assetRepository.deleteById(assetId);
        return Map.of("success", true);
    }

    @PatchMapping("/reorder")
    public List<ProductAssetEntity> reorder(@RequestHeader("Authorization") String auth,
                                             @PathVariable String productId,
                                             @RequestBody List<Map<String, Object>> items) {
        requireAnyRole(auth, R_ADMIN_UP);
        for (Map<String, Object> item : items) {
            Integer id = ((Number) item.get("id")).intValue();
            int order = ((Number) item.get("sortOrder")).intValue();
            assetRepository.findById(id).ifPresent(a -> {
                a.setSortOrder(order);
                assetRepository.save(a);
            });
        }
        return assetRepository.findByProductIdOrderBySortOrderAsc(productId);
    }

    private String extractCloudinaryPublicId(String url) {
        // URL format: https://res.cloudinary.com/{cloud}/image/upload/v123/oceanbazar/products/xxx/filename.ext
        try {
            int uploadIdx = url.indexOf("/upload/");
            if (uploadIdx < 0) return null;
            String afterUpload = url.substring(uploadIdx + 8); // skip "/upload/"
            // Remove version prefix (v123456/)
            if (afterUpload.startsWith("v") && afterUpload.indexOf('/') > 0) {
                afterUpload = afterUpload.substring(afterUpload.indexOf('/') + 1);
            }
            // Remove file extension
            int dotIdx = afterUpload.lastIndexOf('.');
            if (dotIdx > 0) afterUpload = afterUpload.substring(0, dotIdx);
            return afterUpload;
        } catch (Exception e) {
            return null;
        }
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
