package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.AdminUserEntity;
import com.oceanbazar.backend.entity.AuditLogEntity;
import com.oceanbazar.backend.entity.BusinessInquiryEntity;
import com.oceanbazar.backend.entity.CategoryEntity;
import com.oceanbazar.backend.entity.ChatSessionEntity;
import com.oceanbazar.backend.entity.DisputeEntity;
import com.oceanbazar.backend.entity.NotificationEntity;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.ProductAssetEntity;
import com.oceanbazar.backend.entity.SupportAgentEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.entity.WholesaleApplicationEntity;
import com.oceanbazar.backend.entity.enums.AdminRole;
import com.oceanbazar.backend.entity.enums.OrderStatus;
import com.oceanbazar.backend.entity.enums.UserType;
import com.oceanbazar.backend.repository.*;
import com.oceanbazar.backend.security.AdminJwtSupport;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.dto.AdminCustomerDtos;
import com.oceanbazar.backend.dto.AdminNotificationDtos;
import com.oceanbazar.backend.dto.AdminOrderDtos;
import com.oceanbazar.backend.dto.GlobalSettingsDtos;
import com.oceanbazar.backend.service.AdminAlertService;
import com.oceanbazar.backend.service.AdminOrderCommandService;
import com.oceanbazar.backend.service.AdminOrderQueryService;
import com.oceanbazar.backend.service.AdminPaymentCommandService;
import com.oceanbazar.backend.service.AdminPaymentQueryService;
import com.oceanbazar.backend.service.AdminMemberService;
import com.oceanbazar.backend.service.AdminCustomerService;
import com.oceanbazar.backend.service.AdminNotificationService;
import com.oceanbazar.backend.service.LocalFileStorageService;
import com.oceanbazar.backend.service.WebSocketBroadcastService;
import com.oceanbazar.backend.dto.CatalogDtos.*;
import com.oceanbazar.backend.service.ProductExplorerService;
import com.oceanbazar.backend.service.SiteSettingsService;
import com.oceanbazar.backend.service.ChatRealtimeService;
import com.oceanbazar.backend.service.CustomerNotificationService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oceanbazar.backend.utils.ShortId;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.beans.BeanUtils;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private final AdminUserRepository adminUserRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final ChatSessionRepository chatSessionRepository;
    private final SupportAgentRepository supportAgentRepository;
    private final AdminTokenService adminTokenService;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final WholesaleApplicationRepository wholesaleApplicationRepository;
    private final BusinessInquiryRepository businessInquiryRepository;
    private final LocalFileStorageService localFileStorageService;
    private final DisputeRepository disputeRepository;
    private final NotificationRepository notificationRepository;
    private final AdminNotificationService adminNotificationService;
    private final AdminOrderCommandService adminOrderCommandService;
    private final AdminOrderQueryService adminOrderQueryService;
    private final AdminPaymentQueryService adminPaymentQueryService;
    private final AdminPaymentCommandService adminPaymentCommandService;
    private final AdminMemberService adminMemberService;
    private final AdminCustomerService adminCustomerService;
    private final AuditLogRepository auditLogRepository;
    private final com.oceanbazar.backend.repository.PaymentTransactionRepository paymentTransactionRepository;
    private final AdminAlertService adminAlertService;
    private final WebSocketBroadcastService webSocketBroadcastService;
    private final SiteSettingsService siteSettingsService;
    private final CustomerNotificationService customerNotificationService;
    private final ChatRealtimeService chatRealtimeService;
    private final ObjectMapper objectMapper;
    private final ProductExplorerService productExplorerService;
    private final CategoryRepository categoryRepository;
    private final com.oceanbazar.backend.repository.ProductVariantRepository productVariantRepository;
    private final ScheduledExecutorService sseExecutor = Executors.newScheduledThreadPool(2);

    private static final Set<String> ALLOWED_PAYMENT_STATUSES = Set.of(
            "none", "pending", "processing", "paid", "failed", "refunded");

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");
    private static final Set<String> R_ADMIN_UP = Set.of("SUPER_ADMIN", "ADMIN");
    private static final Set<String> R_SUPER = Set.of("SUPER_ADMIN");

    @PostMapping("/auth/login")
    public Map<String, Object> login(@Valid @RequestBody AdminLoginRequest request) {
        AdminUserEntity admin = adminUserRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));
        if (!Boolean.TRUE.equals(admin.getActive()) || !passwordEncoder.matches(request.getPassword(), admin.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }
        AdminRole ar = AdminRole.fromAny(admin.getRole());
        String token = adminTokenService.createAdminToken(String.valueOf(admin.getId()), admin.getUsername(), ar.name());
        return Map.of(
                "token", token,
                "admin", Map.of(
                        "id", admin.getId(),
                        "name", admin.getName(),
                        "username", admin.getUsername(),
                        "email", admin.getEmail(),
                        "role", ar.name(),
                        "roleLabel", ar.getDisplayLabel()
                )
        );
    }

    @GetMapping("/auth/me")
    public Map<String, Object> me(@RequestHeader("Authorization") String authorization) {
        Claims claims = adminTokenService.parseAdmin(authorization);
        Integer adminId = AdminJwtSupport.parseAdminId(claims);
        if (adminId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin token");
        }
        AdminUserEntity admin = adminUserRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin token"));
        AdminRole ar = AdminRole.fromAny(admin.getRole());
        return Map.of(
                "id", admin.getId(),
                "name", admin.getName(),
                "username", admin.getUsername(),
                "email", admin.getEmail(),
                "role", ar.name(),
                "roleLabel", ar.getDisplayLabel(),
                "active", admin.getActive()
        );
    }

    @GetMapping("/overview")
    public Map<String, Object> overview(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ALL);
        List<OrderEntity> orders = orderRepository.findAll();
        double revenue = orders.stream().mapToDouble(o -> o.getTotal() == null ? 0.0 : o.getTotal().doubleValue()).sum();
        Set<String> pipe = OrderStatus.pipelineWireValues();
        long pending = orders.stream().filter(o -> OrderStatus.tryParse(o.getStatus())
                .map(os -> pipe.contains(os.getWireValue()))
                .orElse(false)).count();

        Map<String, Object> response = new HashMap<>();
        response.put("totalProducts", productRepository.count());
        response.put("totalOrders", orders.size());
        response.put("pendingOrders", pending);
        response.put("totalRevenue", Math.round(revenue * 100.0) / 100.0);
        response.put("totalCustomers", userRepository.count());
        response.put("activeChats", chatSessionRepository.countByIsActive(true));
        response.put("adminUnreadNotifications", adminNotificationService.countUnreadAdmins());
        return response;
    }

    /** Primary: {@code /global-settings}; legacy alias {@code /site-settings} for older clients. */
    @GetMapping({"/global-settings", "/site-settings"})
    public Map<String, Object> getGlobalSettings(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ADMIN_UP);
        return siteSettingsService.toAdminMap(siteSettingsService.getOrCreate());
    }

    @PutMapping({"/global-settings", "/site-settings"})
    public Map<String, Object> updateGlobalSettings(@RequestHeader("Authorization") String authorization,
                                                    @Valid @RequestBody GlobalSettingsDtos.UpdateRequest req) {
        requireAnyRole(authorization, R_ADMIN_UP);
        siteSettingsService.applyAdminUpdate(req);
        return siteSettingsService.toAdminMap(siteSettingsService.getOrCreate());
    }

    @GetMapping("/products")
    @Transactional(readOnly = true)
    public List<ProductSummary> products(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ALL);
        return productRepository.findAll(Sort.by(Sort.Direction.DESC, "id")).stream()
                .map(productExplorerService::toSummary)
                .collect(Collectors.toList());
    }

    @PostMapping("/products")
    @Transactional
    public ProductSummary createProduct(@RequestHeader("Authorization") String authorization, @RequestBody ProductEntity product) {
        requireAnyRole(authorization, R_ADMIN_UP);
        validateProductPayload(product);
        String newId = ShortId.newId8();
        product.setId(newId);
        if (product.getTitleBn() == null || product.getTitleBn().isBlank()) {
            product.setTitleBn(product.getTitleEn());
        }
        // Propagate product ID to child entities so JPA can persist them
        if (product.getAssets() != null) product.getAssets().forEach(a -> a.setProductId(newId));
        if (product.getPricing() != null) product.getPricing().forEach(p2 -> p2.setProductId(newId));
        if (product.getVariants() != null) product.getVariants().forEach(v -> v.setProductId(newId));
        if (product.getAttributes() != null) product.getAttributes().forEach(a -> a.setProductId(newId));
        ProductEntity saved = productRepository.save(product);
        adminAlertService.notifyLowStockIfNeeded(saved, null);
        webSocketBroadcastService.broadcastCatalogProductChange(saved.getId(), "created");
        return productExplorerService.toSummary(saved);
    }

    @PutMapping("/products/{id}")
    @Transactional
    public ProductSummary updateProduct(@RequestHeader("Authorization") String authorization, @PathVariable String id, @RequestBody ProductEntity payload) {
        requireAnyRole(authorization, R_ADMIN_UP);
        validateProductPayload(payload);
        ProductEntity existing = productRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        Integer oldStock = existing.getStock();
        existing.setTitleEn(payload.getTitleEn());
        existing.setTitleBn(payload.getTitleBn() != null && !payload.getTitleBn().isBlank() ? payload.getTitleBn() : payload.getTitleEn());
        existing.setDescriptionEn(payload.getDescriptionEn());
        existing.setDescriptionBn(payload.getDescriptionBn());
        existing.setCategoryId(payload.getCategoryId());
        existing.setSellerId(payload.getSellerId());
        existing.setBrandId(payload.getBrandId());
        existing.setBrand(payload.getBrand());
        existing.setSku(payload.getSku());
        if (payload.getStatus() != null) {
            existing.setStatus(payload.getStatus());
        }
        existing.setWeight(payload.getWeight());
        existing.setWeightUnit(payload.getWeightUnit());
        existing.setMoq(payload.getMoq());
        existing.setStock(payload.getStock());
        existing.setSeoTitle(payload.getSeoTitle());
        existing.setSeoDescription(payload.getSeoDescription());
        existing.setImportSource(payload.getImportSource());
        existing.setSpecifications(payload.getSpecifications());
        existing.setAttributesExtra(payload.getAttributesExtra());
        existing.setRatingAvg(payload.getRatingAvg());
        existing.setReviewCount(payload.getReviewCount());
        existing.setBrandLogoUrl(payload.getBrandLogoUrl());
        existing.setPopularityRank(payload.getPopularityRank());
        existing.setPopularityLabelEn(payload.getPopularityLabelEn());
        existing.setPopularityLabelBn(payload.getPopularityLabelBn());
        existing.setReviewsSnapshot(payload.getReviewsSnapshot());
        existing.setIsFeatured(payload.getIsFeatured());
        existing.setPricing(payload.getPricing());
        existing.setVariants(payload.getVariants());
        ProductEntity saved = productRepository.save(existing);
        adminAlertService.notifyLowStockIfNeeded(saved, oldStock);
        webSocketBroadcastService.broadcastCatalogProductChange(saved.getId(), "updated");
        return productExplorerService.toSummary(saved);
    }

    private void validateProductPayload(ProductEntity product) {
        if (product == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product payload is required");
        }
        if (product.getTitleEn() == null || product.getTitleEn().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product title (English) is required");
        }
        if (product.getCategoryId() == null || product.getCategoryId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "categoryId is required");
        }
        CategoryEntity cat = categoryRepository.findById(product.getCategoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category not found: " + product.getCategoryId()));
        if (!Boolean.TRUE.equals(cat.getIsLeaf())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Products can only be placed in leaf categories. '" + cat.getNameEn() + "' has sub-categories.");
        }
        if (product.getMoq() == null || product.getMoq() < 1) {
            product.setMoq(1);
        }
        if (product.getStock() == null || product.getStock() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock must be >= 0");
        }
        if (product.getStatus() == null) {
            product.setStatus("draft");
        }
        if (product.getIsFeatured() == null) {
            product.setIsFeatured(false);
        }
        if (product.getAssets() != null && !product.getAssets().isEmpty()) {
            for (ProductAssetEntity asset : product.getAssets()) {
                if (asset.getUrl() == null || asset.getUrl().isBlank() || !asset.getUrl().matches("^(http|https)://.*")) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid asset URL");
                }
            }
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one asset is required");
        }
    }

    @GetMapping("/products/{id}/detail")
    public ProductDetail getProductDetail(@RequestHeader("Authorization") String authorization, @PathVariable String id) {
        requireAnyRole(authorization, R_ALL);
        return productExplorerService.getProductDetail(id);
    }

    @PatchMapping("/products/{id}/move")
    public ProductEntity moveProduct(@RequestHeader("Authorization") String authorization,
                                     @PathVariable String id,
                                     @RequestBody Map<String, String> body) {
        requireAnyRole(authorization, R_ADMIN_UP);
        String newCategoryId = body.get("categoryId");
        if (newCategoryId == null || newCategoryId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "categoryId is required");
        }
        CategoryEntity target = categoryRepository.findById(newCategoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target category not found"));
        if (!Boolean.TRUE.equals(target.getIsLeaf())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Products can only be placed in leaf categories. '" + target.getNameEn() + "' has sub-categories.");
        }
        ProductEntity moved = productExplorerService.moveProduct(id, newCategoryId);
        webSocketBroadcastService.broadcastCatalogProductChange(id, "moved");
        return moved;
    }

    @PostMapping(value = "/products/bulk-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> bulkUpload(@RequestHeader("Authorization") String authorization,
                                          @RequestParam("file") MultipartFile file) {
        requireAnyRole(authorization, R_ADMIN_UP);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file required");
        }
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        if (!originalName.toLowerCase().endsWith(".csv") && !originalName.toLowerCase().endsWith(".json")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only .csv or .json files accepted");
        }
        return Map.of(
            "status", "queued",
            "message", "Bulk upload queued for processing. This endpoint is future-ready; implement BulkImportService to process rows.",
            "fileName", originalName,
            "sizeBytes", file.getSize()
        );
    }

    @DeleteMapping("/products/{id}")
    public Map<String, Object> deleteProduct(@RequestHeader("Authorization") String authorization, @PathVariable String id) {
        requireAnyRole(authorization, R_ADMIN_UP);
        productRepository.deleteById(id);
        webSocketBroadcastService.broadcastCatalogProductChange(id, "deleted");
        return Map.of("success", true);
    }

    // ─── Variant CRUD ────────────────────────────────────────────────────────────

    @GetMapping("/products/{productId}/variants")
    public List<com.oceanbazar.backend.entity.ProductVariantEntity> getVariants(
            @RequestHeader("Authorization") String authorization,
            @PathVariable String productId) {
        requireAnyRole(authorization, R_ALL);
        return productVariantRepository.findByProductId(productId);
    }

    @PostMapping("/products/{productId}/variants")
    @Transactional
    public com.oceanbazar.backend.entity.ProductVariantEntity createVariant(
            @RequestHeader("Authorization") String authorization,
            @PathVariable String productId,
            @RequestBody com.oceanbazar.backend.entity.ProductVariantEntity payload) {
        requireAnyRole(authorization, R_ADMIN_UP);
        productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        payload.setId(com.oceanbazar.backend.utils.ShortId.generate());
        payload.setProductId(productId);
        if (payload.getNameEn() == null || payload.getNameEn().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "nameEn is required");
        if (payload.getNameBn() == null) payload.setNameBn(payload.getNameEn());
        if (payload.getAttributes() == null) payload.setAttributes("{}");
        if (payload.getStock() == null) payload.setStock(0);
        if (payload.getIsActive() == null) payload.setIsActive(true);
        if (payload.getSortOrder() == null) payload.setSortOrder(0);
        return productVariantRepository.save(payload);
    }

    @PutMapping("/products/{productId}/variants/{variantId}")
    @Transactional
    public com.oceanbazar.backend.entity.ProductVariantEntity updateVariant(
            @RequestHeader("Authorization") String authorization,
            @PathVariable String productId,
            @PathVariable String variantId,
            @RequestBody com.oceanbazar.backend.entity.ProductVariantEntity payload) {
        requireAnyRole(authorization, R_ADMIN_UP);
        com.oceanbazar.backend.entity.ProductVariantEntity existing =
                productVariantRepository.findById(variantId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variant not found"));
        if (!existing.getProductId().equals(productId))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Variant does not belong to this product");
        if (payload.getNameEn() != null) existing.setNameEn(payload.getNameEn());
        if (payload.getNameBn() != null) existing.setNameBn(payload.getNameBn());
        if (payload.getSku() != null) existing.setSku(payload.getSku());
        if (payload.getAttributes() != null) existing.setAttributes(payload.getAttributes());
        if (payload.getPriceOverride() != null) existing.setPriceOverride(payload.getPriceOverride());
        if (payload.getStock() != null) existing.setStock(payload.getStock());
        if (payload.getWeight() != null) existing.setWeight(payload.getWeight());
        if (payload.getIsActive() != null) existing.setIsActive(payload.getIsActive());
        if (payload.getSortOrder() != null) existing.setSortOrder(payload.getSortOrder());
        return productVariantRepository.save(existing);
    }

    @DeleteMapping("/products/{productId}/variants/{variantId}")
    @Transactional
    public Map<String, Object> deleteVariant(
            @RequestHeader("Authorization") String authorization,
            @PathVariable String productId,
            @PathVariable String variantId) {
        requireAnyRole(authorization, R_ADMIN_UP);
        com.oceanbazar.backend.entity.ProductVariantEntity existing =
                productVariantRepository.findById(variantId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variant not found"));
        if (!existing.getProductId().equals(productId))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Variant does not belong to this product");
        productVariantRepository.deleteById(variantId);
        return Map.of("success", true);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadMedia(@RequestHeader("Authorization") String authorization,
                                           @RequestParam("file") MultipartFile file) throws java.io.IOException {
        requireAnyRole(authorization, R_ADMIN_UP);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File required");
        }
        return Map.of("url", localFileStorageService.store(file));
    }

    @PostMapping(value = "/products/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadProductMedia(@RequestHeader("Authorization") String authorization,
                                                  @RequestParam("file") MultipartFile file) throws java.io.IOException {
        requireAnyRole(authorization, R_ADMIN_UP);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File required");
        }
        return Map.of("url", localFileStorageService.storeProductMedia(file));
    }

    @GetMapping("/orders")
    public List<OrderEntity> getOrders(@RequestHeader("Authorization") String authorization,
                                 @RequestParam(required = false) String status) {
        requireAnyRole(authorization, R_ALL);
        return adminOrderQueryService.getOrders(status);
    }

    @GetMapping("/orders/{id}")
    public Map<String, Object> getOrderDetail(@RequestHeader("Authorization") String authorization, @PathVariable String id) {
        requireAnyRole(authorization, R_ALL);
        return adminOrderQueryService.getOrderDetail(id);
    }

    @PatchMapping("/orders/{id}/status")
    public Map<String, Object> updateOrderStatus(@RequestHeader("Authorization") String authorization,
                                                 @PathVariable String id,
                                                 @Valid @RequestBody AdminOrderDtos.AdminOrderStatusUpdateRequest req) {
        Claims claims = requireAnyRole(authorization, R_ALL);
        String actorAdminId = AdminJwtSupport.parseAdminIdStr(claims);
        Map<String, Object> result = adminOrderCommandService.updateOrderStatus(actorAdminId, id, req);
        webSocketBroadcastService.broadcastOrderUpdate(id, Map.of(
                "type", "order_status_updated",
                "orderId", id,
                "status", req.getStatus(),
                "actorAdminId", actorAdminId != null ? actorAdminId : "",
                "at", new Date()
        ));
        return result;
    }

    @PatchMapping("/orders/{id}/tracking")
    public Map<String, Object> updateOrderTracking(@RequestHeader("Authorization") String authorization,
                                                   @PathVariable String id,
                                                   @Valid @RequestBody AdminOrderDtos.AdminOrderTrackingUpdateRequest req) {
        Claims claims = requireAnyRole(authorization, R_ALL);
        String actorAdminId = AdminJwtSupport.parseAdminIdStr(claims);
        Map<String, Object> result = adminOrderCommandService.updateOrderTracking(actorAdminId, id, req);
        webSocketBroadcastService.broadcastOrderUpdate(id, Map.of(
                "type", "order_tracking_updated",
                "orderId", id,
                "actorAdminId", actorAdminId != null ? actorAdminId : "",
                "at", new Date()
        ));
        return result;
    }

    @PatchMapping("/orders/{id}/payment-status")
    public Map<String, Object> updatePaymentStatus(@RequestHeader("Authorization") String authorization,
                                                   @PathVariable String id,
                                                   @Valid @RequestBody AdminOrderDtos.AdminPaymentStatusUpdateRequest req) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        String actorAdminId = AdminJwtSupport.parseAdminIdStr(claims);
        Map<String, Object> result = adminOrderCommandService.updatePaymentStatus(actorAdminId, id, req);
        webSocketBroadcastService.broadcastPaymentUpdate(id, Map.of(
                "type", "payment_status_updated",
                "orderId", id,
                "paymentStatus", req.getPaymentStatus(),
                "actorAdminId", actorAdminId != null ? actorAdminId : "",
                "at", new Date()
        ));
        return result;
    }

    @GetMapping("/payments")
    public List<Map<String, Object>> payments(
            @RequestHeader("Authorization") String authorization,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String status
    ) {
        requireAnyRole(authorization, R_ALL);
        return adminPaymentQueryService.listPayments(status);
    }

    @GetMapping("/payments/{id}")
    public Map<String, Object> paymentDetail(
            @RequestHeader("Authorization") String authorization,
            @PathVariable String id
    ) {
        requireAnyRole(authorization, R_ALL);
        return adminPaymentQueryService.paymentDetail(id);
    }

    @PatchMapping("/payments/{id}")
    public Map<String, Object> patchPayment(
            @RequestHeader("Authorization") String authorization,
            @PathVariable String id,
            @Valid @RequestBody AdminOrderDtos.AdminPaymentStatusUpdateRequest req
    ) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        String actorAdminId = AdminJwtSupport.parseAdminIdStr(claims);
        Map<String, Object> result = adminPaymentCommandService.updatePaymentTransaction(actorAdminId, id, req);
        if (Boolean.TRUE.equals(result.get("orderSynced"))) {
            Object oid = result.get("orderId");
            if (oid instanceof String orderId && !orderId.isBlank()) {
                webSocketBroadcastService.broadcastPaymentUpdate(orderId, Map.of(
                        "type", "payment_status_updated",
                        "orderId", orderId,
                        "paymentStatus", result.get("paymentStatus"),
                        "actorAdminId", actorAdminId != null ? actorAdminId : "",
                        "at", new Date()
                ));
            }
        }
        return result;
    }

    @GetMapping("/disputes")
    public List<DisputeEntity> disputes(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ALL);
        return disputeRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    @PostMapping("/disputes")
    public DisputeEntity createDispute(@RequestHeader("Authorization") String authorization,
                                 @Valid @RequestBody CreateDisputeRequest req) {
        Claims claims = requireAnyRole(authorization, R_ALL);
        OrderEntity order = orderRepository.findById(req.getOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "OrderEntity not found"));
        DisputeEntity d = new DisputeEntity();
        d.setOrderId(order.getId());
        d.setUserId(order.getUserId());
        d.setTitle(req.getTitle());
        d.setDescription(req.getDescription());
        d.setPriority(req.getPriority() == null || req.getPriority().isBlank() ? "medium" : req.getPriority().toLowerCase());
        Integer aid = AdminJwtSupport.parseAdminId(claims);
        d.setAssignedToAdminId(aid == null ? null : String.valueOf(aid));
        d.setStatus("open");
        disputeRepository.save(d);
        logAction(aid == null ? null : String.valueOf(aid), "CREATE_DISPUTE", "dispute", d.getId(), "orderId=" + d.getOrderId());

        String prev = order.getNotes() == null ? "" : order.getNotes();
        order.setNotes(prev + "\n[Dispute] Return requested: " + req.getDescription());
        orderRepository.save(order);
        return d;
    }

    @PatchMapping("/disputes/{id}")
    public Map<String, Object> updateDispute(@RequestHeader("Authorization") String authorization,
                                             @PathVariable String id,
                                             @RequestBody UpdateDisputeRequest req) {
        Claims claims = requireAnyRole(authorization, R_ALL);
        DisputeEntity dispute = disputeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "DisputeEntity not found"));
        if (req.getStatus() != null && !req.getStatus().isBlank()) {
            dispute.setStatus(req.getStatus().trim().toLowerCase());
        }
        if (req.getResolutionNote() != null) {
            dispute.setResolutionNote(req.getResolutionNote());
        }
        Integer aid2 = AdminJwtSupport.parseAdminId(claims);
        dispute.setAssignedToAdminId(aid2 == null ? null : String.valueOf(aid2));
        dispute.setUpdatedAt(Instant.now());
        disputeRepository.save(dispute);
        logAction(aid2 == null ? null : String.valueOf(aid2), "UPDATE_DISPUTE", "dispute", dispute.getId(), "status=" + dispute.getStatus());

        OrderEntity order = orderRepository.findById(dispute.getOrderId()).orElse(null);
        if (order != null) {
            String tag = "requested";
            if ("resolved".equals(dispute.getStatus())) {
                tag = "approved";
            } else if ("rejected".equals(dispute.getStatus())) {
                tag = "rejected";
            }
            String prev = order.getNotes() == null ? "" : order.getNotes();
            order.setNotes(prev + "\n[Dispute] Status " + tag);
            orderRepository.save(order);
        }
        return Map.of("success", true, "id", dispute.getId(), "status", dispute.getStatus());
    }

    @GetMapping("/notifications/unread-count")
    public Map<String, Long> notificationUnreadCount(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ALL);
        return Map.of("count", adminNotificationService.countUnreadAdmins());
    }

    @PatchMapping("/notifications/{id}/read")
    public Map<String, Object> markNotificationRead(@RequestHeader("Authorization") String authorization,
                                                      @PathVariable String id) {
        requireAnyRole(authorization, R_ALL);
        NotificationEntity n = adminNotificationService.markAdminInboxRead(id);
        return Map.of("success", true, "id", n.getId());
    }

    @PostMapping("/notifications/read-all")
    public Map<String, Object> markAllAdminNotificationsRead(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ALL);
        long modified = adminNotificationService.markAllAdminInboxRead();
        return Map.of("success", true, "modifiedCount", modified);
    }

    @GetMapping("/notifications")
    public List<NotificationEntity> notifications(@RequestHeader("Authorization") String authorization,
                                            @RequestParam(required = false) String audience,
                                            @RequestParam(required = false) Boolean adminInbox) {
        requireAnyRole(authorization, R_ALL);
        return adminNotificationService.listNotifications(audience, adminInbox);
    }

    @PostMapping("/notifications")
    public NotificationEntity createNotification(@RequestHeader("Authorization") String authorization,
                                           @Valid @RequestBody AdminNotificationDtos.CreateNotificationRequest req) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        String nAdminId = AdminJwtSupport.parseAdminIdStr(claims);
        NotificationEntity created = adminNotificationService.createNotification(nAdminId, req);
        logAction(nAdminId, "CREATE_NOTIFICATION", "notification", created.getId(), "audience=" + created.getAudience());
        return created;
    }

    @PostMapping("/notifications/broadcast-customers")
    public Map<String, Object> broadcastToCustomers(@RequestHeader("Authorization") String authorization,
                                                    @Valid @RequestBody AdminNotificationDtos.BroadcastToCustomersRequest req) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        String bAdminId = AdminJwtSupport.parseAdminIdStr(claims);
        Map<String, Object> result = adminNotificationService.broadcastToAllActiveCustomers(bAdminId, req);
        logAction(bAdminId, "BROADCAST_CUSTOMERS", "notifications", "all",
                "recipients=" + result.get("recipientCount") + ",failures=" + result.get("failureCount"));
        return result;
    }

    @GetMapping("/audit-logs")
    public List<AuditLogEntity> auditLogs(@RequestHeader("Authorization") String authorization,
                                    @RequestParam(required = false) String targetType,
                                    @RequestParam(required = false) String targetId,
                                    @RequestParam(required = false) String action) {
        requireAnyRole(authorization, R_ADMIN_UP);
        Specification<AuditLogEntity> spec = Specification.where(null);
        if (targetType != null && !targetType.isBlank()) {
            String trimmed = targetType.trim();
            if (trimmed.contains(",")) {
                List<String> types = Arrays.stream(trimmed.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isBlank())
                        .toList();
                if (!types.isEmpty()) {
                    spec = spec.and((root, query, cb) -> root.get("targetType").in(types));
                }
            } else {
                spec = spec.and((root, query, cb) -> cb.equal(root.get("targetType"), trimmed));
            }
        }
        if (targetId != null && !targetId.isBlank()) {
            String tid = targetId.trim();
            spec = spec.and((root, query, cb) -> cb.equal(root.get("targetId"), tid));
        }
        if (action != null && !action.isBlank()) {
            String act = action.trim().toLowerCase();
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("action")), "%" + act + "%"));
        }
        return auditLogRepository.findAll(spec, PageRequest.of(0, 500, Sort.by(Sort.Direction.DESC, "createdAt"))).getContent();
    }

    @DeleteMapping("/disputes/{id}")
    public Map<String, Object> deleteDispute(@RequestHeader("Authorization") String authorization,
                                             @PathVariable String id) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        DisputeEntity dispute = disputeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "DisputeEntity not found"));
        disputeRepository.deleteById(id);
        logAction(AdminJwtSupport.parseAdminIdStr(claims), "DELETE_DISPUTE", "dispute", id, "title=" + dispute.getTitle());
        return Map.of("success", true);
    }

    @DeleteMapping("/notifications/{id}")
    public Map<String, Object> deleteNotification(@RequestHeader("Authorization") String authorization,
                                                   @PathVariable String id) {
        requireAnyRole(authorization, R_ADMIN_UP);
        notificationRepository.deleteById(id);
        return Map.of("success", true);
    }

    @GetMapping("/chat/conversations")
    public List<ChatSessionEntity> conversations(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ALL);
        List<ChatSessionEntity> rows = chatSessionRepository.findAll(Sort.by(Sort.Direction.DESC, "lastMessageAt"));
        for (ChatSessionEntity s : rows) {
            enrichChatSessionForAdmin(s);
        }
        return rows;
    }

    @GetMapping("/chat/conversations/{sessionId}")
    public ChatSessionEntity conversationDetail(@RequestHeader("Authorization") String authorization, @PathVariable String sessionId) {
        requireAnyRole(authorization, R_ALL);
        ChatSessionEntity session = chatSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
        enrichChatSessionForAdmin(session);
        return session;
    }

    /**
     * Adds {@link ChatSessionEntity#getCustomerName()} and {@link ChatSessionEntity#getCustomerType()} for admin UI
     * (not persisted; {@link org.springframework.data.annotation.Transient} on the model).
     */
    private void enrichChatSessionForAdmin(ChatSessionEntity session) {
        if (session == null || session.getUserId() == null || session.getUserId().isBlank()) {
            return;
        }
        userRepository.findById(session.getUserId()).ifPresentOrElse(
                u -> {
                    session.setCustomerName(resolveChatCustomerDisplayName(u));
                    session.setCustomerType(formatChatCustomerType(u));
                },
                () -> {
                    session.setCustomerName(null);
                    session.setCustomerType(null);
                }
        );
    }

    private static String resolveChatCustomerDisplayName(UserEntity u) {
        String n = u.getName();
        if (n != null && !n.isBlank()) {
            return n.trim();
        }
        String email = u.getEmail();
        if (email != null && !email.isBlank()) {
            int at = email.indexOf('@');
            String local = at > 0 ? email.substring(0, at).trim() : email.trim();
            if (!local.isEmpty()) {
                return local;
            }
        }
        return null;
    }

    private static String formatChatCustomerType(UserEntity u) {
        UserType ut = u.getUserType();
        String raw = ut != null ? ut.name() : "";
        if (raw.isBlank()) {
            return "Customer";
        }
        String s = raw.trim().toLowerCase().replace('_', ' ');
        if (s.isEmpty()) {
            return "Customer";
        }
        StringBuilder sb = new StringBuilder();
        for (String part : s.split("\\s+")) {
            if (part.isEmpty()) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(Character.toUpperCase(part.charAt(0)));
            if (part.length() > 1) {
                sb.append(part.substring(1));
            }
        }
        return sb.length() > 0 ? sb.toString() : "Customer";
    }

    @GetMapping("/live/snapshot")
    public Map<String, Object> liveSnapshot(@RequestHeader(value = "Authorization", required = false) String authorization,
                                            @RequestParam(value = "token", required = false) String token) {
        requireAnyRole(resolveLiveAuthorization(authorization, token), R_ALL);
        return buildLiveSnapshot();
    }

    @GetMapping(path = "/live/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter liveStream(@RequestHeader(value = "Authorization", required = false) String authorization,
                                 @RequestParam(value = "token", required = false) String token) {
        requireAnyRole(resolveLiveAuthorization(authorization, token), R_ALL);

        SseEmitter emitter = new SseEmitter(0L);
        Runnable push = () -> {
            try {
                emitter.send(SseEmitter.event().name("live_update").data(buildLiveSnapshot()));
            } catch (Exception ex) {
                emitter.complete();
            }
        };

        push.run();
        ScheduledFuture<?> task = sseExecutor.scheduleAtFixedRate(push, 3, 3, TimeUnit.SECONDS);
        emitter.onCompletion(() -> task.cancel(true));
        emitter.onTimeout(() -> {
            task.cancel(true);
            emitter.complete();
        });
        return emitter;
    }

    @GetMapping("/team/members")
    public List<Map<String, Object>> members(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ALL);
        List<Map<String, Object>> out = new ArrayList<>();
        for (AdminUserEntity a : adminUserRepository.findAll()) {
            AdminRole ar = AdminRole.fromAny(a.getRole());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", a.getId());
            row.put("memberId", "ADM-" + a.getUsername());
            row.put("name", a.getName());
            row.put("email", a.getEmail());
            row.put("role", ar.name());
            row.put("roleLabel", ar.getDisplayLabel());
            row.put("active", a.getActive());
            row.put("accountType", "admin");
            out.add(row);
        }
        for (SupportAgentEntity s : supportAgentRepository.findAll()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", s.getId());
            row.put("memberId", s.getAgentId());
            row.put("name", s.getName());
            row.put("email", s.getEmail());
            row.put("role", s.getRole());
            row.put("roleLabel", s.getRole());
            row.put("active", s.getActive());
            row.put("accountType", "support");
            out.add(row);
        }
        return out;
    }

    @GetMapping("/members/{id}")
    public Map<String, Object> memberDetail(@RequestHeader("Authorization") String authorization, @PathVariable String id) {
        requireAnyRole(authorization, R_ALL);
        int memberPk;
        try {
            memberPk = Integer.parseInt(id.trim());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid member id");
        }
        AdminUserEntity member = adminUserRepository.findById(memberPk).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));
        AdminRole ar = AdminRole.fromAny(member.getRole());
        return Map.of(
                "id", member.getId(),
                "name", member.getName(),
                "username", member.getUsername(),
                "email", member.getEmail(),
                "role", ar.name(),
                "roleLabel", ar.getDisplayLabel(),
                "active", member.getActive(),
                "createdAt", member.getCreatedAt()
        );
    }

    @PostMapping("/members")
    public Map<String, Object> addMember(@RequestHeader("Authorization") String authorization, @Valid @RequestBody AddMemberRequest req) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        String actorId = AdminJwtSupport.parseAdminIdStr(claims);
        AdminRole actor = resolveActorRole(actorId);
        Map<String, Object> result = adminMemberService.addMember(
                actorId,
                actor,
                req.getName(),
                req.getUsername(),
                req.getEmail(),
                req.getPassword(),
                req.getRole()
        );
        webSocketBroadcastService.broadcastUserUpdate(Map.of(
                "type", "user_member_added",
                "memberId", String.valueOf(result.getOrDefault("id", "")),
                "actorAdminId", actorId != null ? actorId : "",
                "at", new Date()
        ));
        return result;
    }

    @PutMapping("/members/{id}")
    public Map<String, Object> updateMember(@RequestHeader("Authorization") String authorization, @PathVariable String id, @RequestBody UpdateMemberRequest req) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        String actorId = AdminJwtSupport.parseAdminIdStr(claims);
        AdminRole actor = resolveActorRole(actorId);
        Map<String, Object> result = adminMemberService.updateMember(
                actorId,
                actor,
                id,
                req.getName(),
                req.getEmail(),
                req.getRole(),
                req.getActive()
        );
        webSocketBroadcastService.broadcastUserUpdate(Map.of(
                "type", "user_member_updated",
                "memberId", id,
                "actorAdminId", actorId != null ? actorId : "",
                "at", new Date()
        ));
        return result;
    }

    @DeleteMapping("/members/{id}")
    public Map<String, Object> deleteMember(@RequestHeader("Authorization") String authorization, @PathVariable String id) {
        Claims claims = requireAnyRole(authorization, R_SUPER);
        String actorId = AdminJwtSupport.parseAdminIdStr(claims);
        AdminRole actor = resolveActorRole(actorId);
        Map<String, Object> result = adminMemberService.deleteMember(actorId, actor, id);
        webSocketBroadcastService.broadcastUserUpdate(Map.of(
                "type", "user_member_deleted",
                "memberId", id,
                "actorAdminId", actorId != null ? actorId : "",
                "at", new Date()
        ));
        return result;
    }

    @GetMapping("/customers")
    public List<UserEntity> customers(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ALL);
        return adminCustomerService.listCustomers();
    }

    @GetMapping("/customers/{id}")
    public UserEntity getCustomer(@RequestHeader("Authorization") String authorization, @PathVariable String id) {
        requireAnyRole(authorization, R_ALL);
        return adminCustomerService.getCustomer(id);
    }

    @GetMapping("/customers/{id}/orders")
    public List<OrderEntity> getCustomerOrders(@RequestHeader("Authorization") String authorization, @PathVariable String id) {
        requireAnyRole(authorization, R_ALL);
        return adminCustomerService.getCustomerOrders(id);
    }

    @PatchMapping("/customers/{id}/account-status")
    public UserEntity patchCustomerAccountStatus(@RequestHeader("Authorization") String authorization,
                                           @PathVariable String id,
                                           @Valid @RequestBody CustomerAccountStatusRequest req) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        String actorId = AdminJwtSupport.parseAdminIdStr(claims);
        UserEntity updated = adminCustomerService.patchCustomerAccountStatus(actorId, id, req.getStatus(), req.getReason());
        webSocketBroadcastService.broadcastUserUpdate(Map.of(
                "type", "user_customer_status_updated",
                "userId", id,
                "status", req.getStatus(),
                "actorAdminId", actorId != null ? actorId : "",
                "at", new Date()
        ));
        return updated;
    }

    @PutMapping("/customers/{id}")
    public UserEntity updateCustomer(@RequestHeader("Authorization") String authorization,
                               @PathVariable String id,
                               @Valid @RequestBody AdminCustomerDtos.AdminCustomerProfileUpdateRequest req) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        String actorId = AdminJwtSupport.parseAdminIdStr(claims);
        UserEntity updated = adminCustomerService.updateCustomerProfile(actorId, id, req);
        webSocketBroadcastService.broadcastUserUpdate(Map.of(
                "type", "user_customer_updated",
                "userId", id,
                "actorAdminId", actorId != null ? actorId : "",
                "at", new Date()
        ));
        return updated;
    }

    @PostMapping("/wholesale/{userId}/approve")
    public Map<String, Object> approveWholesale(@RequestHeader("Authorization") String authorization, @PathVariable String userId) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        UserEntity user = userRepository.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found"));
        user.setUserType(UserType.wholesale);
        userRepository.save(user);
        Integer aid = AdminJwtSupport.parseAdminId(claims);
        logAction(aid == null ? null : String.valueOf(aid), "APPROVE_WHOLESALE", "customer", userId, null);

        wholesaleApplicationRepository.findFirstByUserIdOrderByCreatedAtDesc(userId).ifPresent(app -> {
            app.setStatus("approved");
            app.setUpdatedAt(Instant.now());
            wholesaleApplicationRepository.save(app);
        });
        customerNotificationService.notifyCustomer(
                userId,
                "Wholesale access approved",
                "Your wholesale account is active. You can now see wholesale pricing at checkout.",
                "account",
                userId
        );
        return Map.of("success", true, "userType", "wholesale");
    }

    @PostMapping("/wholesale/{userId}/revoke")
    public Map<String, Object> revokeWholesale(@RequestHeader("Authorization") String authorization, @PathVariable String userId) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        UserEntity user = userRepository.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found"));
        user.setUserType(UserType.retail);
        userRepository.save(user);
        Integer aidR = AdminJwtSupport.parseAdminId(claims);
        logAction(aidR == null ? null : String.valueOf(aidR), "REVOKE_WHOLESALE", "customer", userId, null);

        wholesaleApplicationRepository.findFirstByUserIdOrderByCreatedAtDesc(userId).ifPresent(app -> {
            app.setStatus("revoked");
            app.setUpdatedAt(Instant.now());
            wholesaleApplicationRepository.save(app);
        });
        return Map.of("success", true, "userType", "retail");
    }

    @DeleteMapping("/customers/{id}")
    public Map<String, Object> deleteCustomer(@RequestHeader("Authorization") String authorization, @PathVariable String id) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        String actorId = AdminJwtSupport.parseAdminIdStr(claims);
        Map<String, Object> result = adminCustomerService.deleteCustomer(id);
        logAction(actorId, "DELETE_CUSTOMER", "customer", id, null);
        webSocketBroadcastService.broadcastUserUpdate(Map.of(
                "type", "user_customer_deleted",
                "userId", id,
                "at", new Date()
        ));
        return result;
    }

    private UserEntity stripPassword(UserEntity src) {
        UserEntity out = new UserEntity();
        BeanUtils.copyProperties(src, out);
        out.setPasswordHash(null);
        return out;
    }

    @GetMapping("/applications/wholesale")
    public List<WholesaleApplicationEntity> wholesaleApplications(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ADMIN_UP);
        return wholesaleApplicationRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    @GetMapping("/applications/business-inquiries")
    public List<BusinessInquiryEntity> businessInquiries(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ADMIN_UP);
        return businessInquiryRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    @PatchMapping("/applications/wholesale/{id}")
    public Map<String, Object> updateWholesaleApplication(
            @RequestHeader("Authorization") String authorization,
            @PathVariable String id,
            @Valid @RequestBody ApplicationReviewRequest req
    ) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        String status = req.getStatus().trim().toLowerCase();
        if (!Set.of("approved", "rejected", "pending").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status");
        }

        WholesaleApplicationEntity app = wholesaleApplicationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Wholesale application not found"));
        app.setStatus(status);
        app.setAdminNotes(req.getNotes());
        Integer aidW = AdminJwtSupport.parseAdminId(claims);
        app.setReviewedByAdminId(aidW == null ? null : String.valueOf(aidW));
        Instant rw = Instant.now();
        app.setReviewedAt(rw);
        app.setUpdatedAt(rw);
        wholesaleApplicationRepository.save(app);

        if ("approved".equals(status) && app.getUserId() != null) {
            userRepository.findById(app.getUserId()).ifPresent(user -> {
                user.setUserType(UserType.wholesale);
                userRepository.save(user);
            });
            customerNotificationService.notifyCustomer(
                    app.getUserId(),
                    "Wholesale application approved",
                    "Your wholesale application was approved. Wholesale pricing is now available.",
                    "account",
                    app.getUserId()
            );
        }
        if ("rejected".equals(status) && app.getUserId() != null) {
            userRepository.findById(app.getUserId()).ifPresent(user -> {
                if (user.getUserType() == UserType.wholesale) {
                    user.setUserType(UserType.retail);
                    userRepository.save(user);
                }
            });
            String notes = req.getNotes() == null || req.getNotes().isBlank()
                    ? ""
                    : " Admin note: " + req.getNotes().trim();
            customerNotificationService.notifyCustomer(
                    app.getUserId(),
                    "Wholesale application not approved",
                    "Your wholesale application was not approved at this time." + notes,
                    "account",
                    app.getUserId()
            );
        }

        logAction(aidW == null ? null : String.valueOf(aidW), "REVIEW_WHOLESALE_APP", "application", app.getId(), "status=" + app.getStatus());
        return Map.of("success", true, "id", app.getId(), "status", app.getStatus());
    }

    @PatchMapping("/applications/partner-requests/{id}")
    public Map<String, Object> updatePartnerRequest(
            @RequestHeader("Authorization") String authorization,
            @PathVariable String id,
            @Valid @RequestBody ApplicationReviewRequest req
    ) {
        Claims claims = requireAnyRole(authorization, R_ADMIN_UP);
        String status = req.getStatus().trim().toLowerCase();
        if (!Set.of("approved", "rejected", "pending").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status");
        }

        BusinessInquiryEntity inquiry = businessInquiryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Partner request not found"));
        inquiry.setStatus(status);
        inquiry.setAdminNotes(req.getNotes());
        Integer aid = AdminJwtSupport.parseAdminId(claims);
        inquiry.setReviewedByAdminId(aid == null ? null : String.valueOf(aid));
        Instant reviewed = Instant.now();
        inquiry.setReviewedAt(reviewed);
        inquiry.setUpdatedAt(reviewed);
        businessInquiryRepository.save(inquiry);
        logAction(aid == null ? null : String.valueOf(aid), "REVIEW_PARTNER_REQ", "application", inquiry.getId(), "status=" + inquiry.getStatus());
        return Map.of("success", true, "id", inquiry.getId(), "status", inquiry.getStatus());
    }


    @PostMapping("/chat/conversations/{sessionId}/reply")
    public Map<String, Object> replyConversation(@RequestHeader("Authorization") String authorization,
                                                 @PathVariable String sessionId,
                                                 @RequestBody ReplyRequest request) {
        Claims claims = requireAnyRole(authorization, R_ALL);
        ChatSessionEntity session = chatSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
        try {
            List<Map<String, Object>> msgs = parseChatMessages(session.getMessages());
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("id", UUID.randomUUID().toString());
            msg.put("userId", session.getUserId());
            Integer aid = AdminJwtSupport.parseAdminId(claims);
            if (aid != null) {
                msg.put("agentId", aid);
            }
            msg.put("sender", "agent");
            msg.put("message", request.getMessage());
            msg.put("timestamp", Instant.now().toEpochMilli());
            msg.put("isRead", false);
            msgs.add(msg);
            session.setMessages(objectMapper.writeValueAsString(msgs));
            session.setLastMessageAt(Instant.now());
            session.setAgentEngaged(true);
            session.setIsActive(true);
            chatSessionRepository.save(session);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save reply");
        }
        if (session.getUserId() != null && !session.getUserId().isBlank()) {
            chatRealtimeService.publishUserChatSession(session.getUserId());
        }
        webSocketBroadcastService.broadcastChatUpdate(Map.of(
                "type", "chat_replied",
                "sessionId", sessionId,
                "userId", session.getUserId(),
                "at", new Date()
        ));
        return Map.of("success", true);
    }

    @PostMapping("/chat/conversations/{sessionId}/close")
    public Map<String, Object> closeAgentConversation(@RequestHeader("Authorization") String authorization,
                                                      @PathVariable String sessionId) {
        requireAnyRole(authorization, R_ALL);
        ChatSessionEntity session = chatSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
        Instant now = Instant.now();
        appendAutomatedMessage(session,
                "We truly hope we were able to help you today. When you have a moment, could you share a quick note about how we did? Your feedback helps our whole team grow and serve you better.");
        appendAutomatedMessage(session,
                "From everyone here at OceanBazar—thank you from the bottom of our hearts for trusting us. We are always a message away whenever you need us. Stay well, and take care!");
        session.setAgentEngaged(false);
        session.setIsActive(false);
        session.setClosedByAgentAt(now);
        session.setLastMessageAt(now);
        chatSessionRepository.save(session);
        if (session.getUserId() != null && !session.getUserId().isBlank()) {
            chatRealtimeService.publishUserChatSession(session.getUserId());
        }
        webSocketBroadcastService.broadcastChatUpdate(Map.of(
                "type", "chat_closed",
                "sessionId", sessionId,
                "userId", session.getUserId(),
                "at", new Date()
        ));
        return Map.of("success", true);
    }

    private void appendAutomatedMessage(ChatSessionEntity session, String text) {
        try {
            List<Map<String, Object>> msgs = parseChatMessages(session.getMessages());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", UUID.randomUUID().toString());
            m.put("userId", session.getUserId());
            m.put("message", text);
            m.put("sender", "bot");
            m.put("timestamp", Instant.now().toEpochMilli());
            m.put("isRead", false);
            msgs.add(m);
            session.setMessages(objectMapper.writeValueAsString(msgs));
        } catch (Exception ignored) {
        }
    }

    private String resolveLiveAuthorization(String authorization, String token) {
        if (authorization != null && !authorization.isBlank()) {
            return authorization;
        }
        if (token != null && !token.isBlank()) {
            return "Bearer " + token.trim();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin token");
    }

    private Map<String, Object> buildLiveSnapshot() {
        long orders = orderRepository.count();
        long customers = userRepository.count();
        long products = productRepository.count();
        long disputes = disputeRepository.count();
        long payments = paymentTransactionRepository.count();
        long messages = countUnreadUserMessages();
        long activeChats = chatSessionRepository.countByIsActive(true);
        long adminUnread = adminNotificationService.countUnreadAdmins();

        List<Map<String, Object>> recentNotifications = adminNotificationService
                .listNotifications(null, true)
                .stream()
                .limit(10)
                .map(n -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", n.getId() == null ? "" : n.getId());
                    row.put("title", n.getTitle() == null ? "" : n.getTitle());
                    row.put("message", n.getMessage() == null ? "" : n.getMessage());
                    row.put("kind", n.getKind() == null ? "" : n.getKind());
                    row.put("entityId", n.getEntityId() == null ? "" : n.getEntityId());
                    row.put("read", Boolean.TRUE.equals(n.getReadStatus()));
                    row.put("createdAt", n.getCreatedAt());
                    return row;
                })
                .toList();

        Map<String, Object> counters = new LinkedHashMap<>();
        counters.put("orders", orders);
        counters.put("customers", customers);
        counters.put("messages", messages);
        counters.put("payments", payments);
        counters.put("products", products);
        counters.put("disputes", disputes);
        counters.put("activeChats", activeChats);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("counters", counters);
        payload.put("adminUnreadNotifications", adminUnread);
        payload.put("recentNotifications", recentNotifications);
        payload.put("generatedAt", new Date());
        return payload;
    }

    private List<Map<String, Object>> parseChatMessages(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private long countUnreadUserMessages() {
        long unread = 0L;
        for (ChatSessionEntity session : chatSessionRepository.findAll()) {
            for (Map<String, Object> message : parseChatMessages(session.getMessages())) {
                if (message == null) continue;
                Object sender = message.get("sender");
                Object read = message.get("isRead");
                if ("user".equalsIgnoreCase(sender != null ? String.valueOf(sender) : "")
                        && !Boolean.TRUE.equals(read)) {
                    unread += 1;
                }
            }
        }
        return unread;
    }

    private AdminRole resolveActorRole(String adminId) {
        if (adminId == null || adminId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin actor id");
        }
        int id;
        try {
            id = Integer.parseInt(adminId.trim());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin actor id");
        }
        AdminUserEntity u = adminUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin token"));
        return AdminRole.fromAny(u.getRole());
    }

    private long countActiveSuperAdmins() {
        return adminUserRepository.findAll().stream()
                .filter(a -> Boolean.TRUE.equals(a.getActive()))
                .filter(a -> AdminRole.fromAny(a.getRole()) == AdminRole.super_admin)
                .count();
    }

    private void assertActorMayAssign(AdminRole actor, AdminRole targetRole) {
        if (targetRole == AdminRole.super_admin && actor != AdminRole.super_admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only Super Admin can assign the Super Admin role");
        }
    }

    private void assertActorMayModifyTarget(AdminRole actor, AdminRole targetRole) {
        if (actor == AdminRole.admin && targetRole == AdminRole.super_admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient permissions to modify this administrator");
        }
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }

    private void logAction(String adminId, String action, String targetType, String targetId, String details) {
        if (adminId == null || adminId.isBlank()) {
            return;
        }
        AuditLogEntity log = new AuditLogEntity();
        try {
            log.setAdminId(Integer.valueOf(adminId.trim()));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid admin id");
        }
        log.setAction(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setDetails(details);
        auditLogRepository.save(log);
    }

    @Data
    public static class AdminLoginRequest {
        @NotBlank
        private String username;
        @NotBlank
        private String password;
    }

    @Data
    public static class AddMemberRequest {
        @NotBlank
        @Size(min = 2, max = 80)
        private String name;
        @NotBlank
        @Size(min = 3, max = 50)
        private String username;
        @Email
        @NotBlank
        private String email;
        @NotBlank
        @Size(min = 6, max = 120)
        private String password;
        @NotBlank
        private String role;
    }

    @Data
    public static class UpdateMemberRequest {
        @Size(min = 2, max = 80)
        private String name;
        @Email
        private String email;
        private String role;
        private Boolean active;
    }

    @Data
    public static class CreateDisputeRequest {
        @NotBlank
        private String orderId;
        @NotBlank
        @Size(max = 120)
        private String title;
        @NotBlank
        @Size(max = 1000)
        private String description;
        private String priority;
    }

    @Data
    public static class UpdateDisputeRequest {
        private String status;
        private String resolutionNote;
    }

    @Data
    public static class ReplyRequest {
        @NotBlank
        @Size(max = 2000)
        private String message;
    }

    @Data
    public static class CustomerAccountStatusRequest {
        @NotBlank
        @Pattern(regexp = "(?i)active|deactivated|banned")
        private String status;
        @Size(max = 500)
        private String reason;
    }

    @Data
    public static class ApplicationReviewRequest {
        @NotBlank
        @Pattern(regexp = "(?i)approved|rejected|pending")
        private String status;
        @Size(max = 1000)
        private String notes;
    }

}
