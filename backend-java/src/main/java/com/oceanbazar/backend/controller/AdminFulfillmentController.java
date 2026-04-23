package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.ShipmentEntity;
import com.oceanbazar.backend.entity.enums.ShipmentStatus;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.service.FulfillmentService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/api/admin/fulfillment")
@RequiredArgsConstructor
public class AdminFulfillmentController {
    private final FulfillmentService fulfillmentService;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");
    private static final Set<String> R_ADMIN_UP = Set.of("SUPER_ADMIN", "ADMIN");

    @GetMapping("/shipments")
    public List<ShipmentEntity> list(@RequestHeader("Authorization") String auth, @RequestParam(required = false) String status) {
        requireAnyRole(auth, R_ALL);
        if (status != null && !status.isBlank()) {
            try {
                ShipmentStatus st = ShipmentStatus.valueOf(status.trim().toLowerCase().replace('-', '_'));
                return fulfillmentService.listByStatus(st);
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid shipment status");
            }
        }
        return fulfillmentService.listAll();
    }

    @GetMapping("/shipments/{id}")
    public ShipmentEntity getById(@RequestHeader("Authorization") String auth, @PathVariable String id) {
        requireAnyRole(auth, R_ALL);
        return fulfillmentService.getById(id);
    }

    @GetMapping("/shipments/order/{orderId}")
    public List<ShipmentEntity> byOrder(@RequestHeader("Authorization") String auth, @PathVariable String orderId) {
        requireAnyRole(auth, R_ALL);
        return fulfillmentService.listByOrder(orderId);
    }

    @PostMapping("/shipments")
    public ShipmentEntity create(@RequestHeader("Authorization") String auth, @RequestBody ShipmentEntity shipment) {
        requireAnyRole(auth, R_ALL);
        return fulfillmentService.createShipment(shipment);
    }

    @PatchMapping("/shipments/{id}/status")
    public ShipmentEntity updateStatus(@RequestHeader("Authorization") String auth, @PathVariable String id, @RequestBody Map<String, String> body) {
        requireAnyRole(auth, R_ALL);
        return fulfillmentService.updateStatus(id, body.get("status"), body.get("location"), body.get("description"));
    }

    @PutMapping("/shipments/{id}/tracking")
    public ShipmentEntity updateTracking(@RequestHeader("Authorization") String auth, @PathVariable String id, @RequestBody Map<String, String> body) {
        requireAnyRole(auth, R_ALL);
        return fulfillmentService.updateTracking(id, body.get("carrier"), body.get("trackingNumber"));
    }

    @DeleteMapping("/shipments/{id}")
    public Map<String, Object> deleteShipment(@RequestHeader("Authorization") String auth, @PathVariable String id) {
        requireAnyRole(auth, R_ADMIN_UP);
        fulfillmentService.deleteShipment(id);
        return Map.of("success", true, "id", id);
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
