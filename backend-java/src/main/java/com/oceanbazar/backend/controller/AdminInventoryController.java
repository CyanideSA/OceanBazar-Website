package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.InventoryItemEntity;
import com.oceanbazar.backend.entity.InventoryTransactionEntity;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.security.AdminJwtSupport;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.service.InventoryService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin/inventory")
@RequiredArgsConstructor
public class AdminInventoryController {
    private final InventoryService inventoryService;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");
    private static final Set<String> R_ADMIN_UP = Set.of("SUPER_ADMIN", "ADMIN");

    @GetMapping
    public List<InventoryItemEntity> list(@RequestHeader("Authorization") String auth) {
        requireAnyRole(auth, R_ALL);
        return inventoryService.listAll();
    }

    @GetMapping("/product/{productId}")
    public List<InventoryItemEntity> listByProduct(@RequestHeader("Authorization") String auth, @PathVariable String productId) {
        requireAnyRole(auth, R_ALL);
        return inventoryService.listByProduct(productId);
    }

    @GetMapping("/low-stock")
    public List<InventoryItemEntity> lowStock(@RequestHeader("Authorization") String auth, @RequestParam(defaultValue = "10") int threshold) {
        requireAnyRole(auth, R_ALL);
        return inventoryService.listLowStock(threshold);
    }

    @PostMapping("/{itemId}/adjust")
    public InventoryItemEntity adjustStock(@RequestHeader("Authorization") String auth,
                                     @PathVariable String itemId,
                                     @RequestBody Map<String, Object> body) {
        Claims claims = requireAnyRole(auth, R_ADMIN_UP);
        int qty = ((Number) body.getOrDefault("quantity", 0)).intValue();
        String note = (String) body.getOrDefault("note", "Manual adjustment");
        return inventoryService.adjustStock(itemId, qty, note, AdminJwtSupport.parseAdminIdStr(claims));
    }

    @PostMapping("/{itemId}/set-quantity")
    public InventoryItemEntity setQuantity(@RequestHeader("Authorization") String auth,
                                       @PathVariable String itemId,
                                       @RequestBody Map<String, Object> body) {
        Claims claims = requireAnyRole(auth, R_ADMIN_UP);
        int newQty = ((Number) body.getOrDefault("newQuantity", 0)).intValue();
        String note = (String) body.getOrDefault("note", "Restock / set quantity");
        return inventoryService.setStockAbsolute(itemId, newQty, note, AdminJwtSupport.parseAdminIdStr(claims));
    }

    @GetMapping("/transactions/{productId}")
    public List<InventoryTransactionEntity> transactions(@RequestHeader("Authorization") String auth, @PathVariable String productId) {
        requireAnyRole(auth, R_ALL);
        return inventoryService.getTransactionHistory(productId);
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
