package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.ProductPricingEntity;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.ProductPricingRepository;
import com.oceanbazar.backend.repository.ProductRepository;
import com.oceanbazar.backend.security.AdminTokenService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Manages retail + wholesale pricing tiers for a product.
 *
 * Pricing rows use customerType = "retail" | "wholesale".
 * Each row carries up to 3 volume tiers (tier1/tier2/tier3) for dynamic
 * quantity-based price switching.
 *
 * GET    /api/admin/products/{productId}/pricing          -> list all pricing rows
 * POST   /api/admin/products/{productId}/pricing          -> upsert a pricing row
 * PUT    /api/admin/products/{productId}/pricing/{id}     -> update a pricing row
 * DELETE /api/admin/products/{productId}/pricing/{id}     -> delete a pricing row
 * PUT    /api/admin/products/{productId}/pricing/replace  -> replace ALL pricing rows atomically
 */
@RestController
@RequestMapping("/api/admin/products/{productId}/pricing")
@RequiredArgsConstructor
public class AdminProductPricingController {

    private final ProductPricingRepository pricingRepository;
    private final ProductRepository productRepository;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL      = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");
    private static final Set<String> R_ADMIN_UP = Set.of("SUPER_ADMIN", "ADMIN");

    @GetMapping
    public List<ProductPricingEntity> list(@RequestHeader("Authorization") String auth,
                                            @PathVariable String productId) {
        requireAnyRole(auth, R_ALL);
        requireProduct(productId);
        return pricingRepository.findByProductIdOrderBySortOrderAsc(productId);
    }

    @PostMapping
    public ProductPricingEntity upsert(@RequestHeader("Authorization") String auth,
                                        @PathVariable String productId,
                                        @RequestBody ProductPricingEntity payload) {
        requireAnyRole(auth, R_ADMIN_UP);
        requireProduct(productId);
        validatePricingPayload(payload);
        payload.setProductId(productId);
        if (payload.getSortOrder() == null) {
            payload.setSortOrder("retail".equalsIgnoreCase(payload.getCustomerType()) ? 0 : 1);
        }
        // Upsert by customerType — replace existing row if present
        pricingRepository.findByProductIdAndCustomerType(productId, payload.getCustomerType())
                .ifPresent(existing -> payload.setId(existing.getId()));
        return pricingRepository.save(payload);
    }

    @PutMapping("/{id}")
    public ProductPricingEntity update(@RequestHeader("Authorization") String auth,
                                        @PathVariable String productId,
                                        @PathVariable Integer id,
                                        @RequestBody ProductPricingEntity payload) {
        requireAnyRole(auth, R_ADMIN_UP);
        if (id == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "id is required");
        ProductPricingEntity existing = pricingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pricing row not found"));
        if (!Objects.equals(existing.getProductId(), productId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pricing row does not belong to this product");
        }
        if (payload.getPrice() != null) existing.setPrice(payload.getPrice());
        if (payload.getCompareAt() != null) existing.setCompareAt(payload.getCompareAt());
        if (payload.getTier1MinQty() != null) existing.setTier1MinQty(payload.getTier1MinQty());
        if (payload.getTier1Discount() != null) existing.setTier1Discount(payload.getTier1Discount());
        if (payload.getTier2MinQty() != null) existing.setTier2MinQty(payload.getTier2MinQty());
        if (payload.getTier2Discount() != null) existing.setTier2Discount(payload.getTier2Discount());
        if (payload.getTier3MinQty() != null) existing.setTier3MinQty(payload.getTier3MinQty());
        if (payload.getTier3Discount() != null) existing.setTier3Discount(payload.getTier3Discount());
        if (payload.getSortOrder() != null) existing.setSortOrder(payload.getSortOrder());
        return pricingRepository.save(existing);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@RequestHeader("Authorization") String auth,
                                       @PathVariable String productId,
                                       @PathVariable Integer id) {
        requireAnyRole(auth, R_ADMIN_UP);
        if (id == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "id is required");
        ProductPricingEntity existing = pricingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pricing row not found"));
        if (!Objects.equals(existing.getProductId(), productId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pricing row does not belong to this product");
        }
        pricingRepository.deleteById(id);
        return Map.of("success", true);
    }

    /**
     * Atomically replace ALL pricing rows for this product.
     * Body: list of pricing rows (retail + wholesale).
     */
    @PutMapping("/replace")
    public List<ProductPricingEntity> replace(@RequestHeader("Authorization") String auth,
                                               @PathVariable String productId,
                                               @RequestBody List<ProductPricingEntity> rows) {
        requireAnyRole(auth, R_ADMIN_UP);
        requireProduct(productId);
        if (rows == null || rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one pricing row is required");
        }
        rows.forEach(this::validatePricingPayload);
        pricingRepository.deleteByProductId(productId);
        int sortOrder = 0;
        for (ProductPricingEntity row : rows) {
            row.setId(null);
            row.setProductId(productId);
            if (row.getSortOrder() == null) row.setSortOrder(sortOrder++);
        }
        return pricingRepository.saveAll(rows);
    }

    private void requireProduct(String productId) {
        if (productId == null || productId.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "productId is required");
        if (!productRepository.existsById(productId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found: " + productId);
        }
    }

    private void validatePricingPayload(ProductPricingEntity p) {
        if (p.getCustomerType() == null || p.getCustomerType().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "customerType is required (retail | wholesale)");
        }
        String ct = p.getCustomerType().toLowerCase();
        if (!ct.equals("retail") && !ct.equals("wholesale")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "customerType must be 'retail' or 'wholesale'");
        }
        p.setCustomerType(ct);
        if (p.getPrice() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "price is required");
        }
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
