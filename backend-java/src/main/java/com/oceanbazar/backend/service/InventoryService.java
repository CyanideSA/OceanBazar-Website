package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.InventoryItemEntity;
import com.oceanbazar.backend.entity.InventoryReservationEntity;
import com.oceanbazar.backend.entity.InventoryTransactionEntity;
import com.oceanbazar.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InventoryService {
    private final InventoryItemRepository inventoryItemRepository;
    private final InventoryReservationRepository reservationRepository;
    private final InventoryTransactionRepository transactionRepository;
    private final ProductRepository productRepository;
    private final WebSocketBroadcastService webSocketBroadcastService;

    @Value("${oceanbazar.inventory.low-stock-threshold:10}")
    private int lowStockBroadcastThreshold;

    public List<InventoryItemEntity> listAll() {
        return inventoryItemRepository.findAll();
    }

    public List<InventoryItemEntity> listByProduct(String productId) {
        return inventoryItemRepository.findByProductId(productId);
    }

    public List<InventoryItemEntity> listLowStock(int threshold) {
        return inventoryItemRepository.findByQuantityAvailableLessThanEqual(threshold);
    }

    public InventoryItemEntity adjustStock(String inventoryItemId, int quantityChange, String note, String actorId) {
        InventoryItemEntity item = inventoryItemRepository.findById(inventoryItemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found"));
        int previousOnHand = item.getQuantityOnHand();
        item.setQuantityOnHand(previousOnHand + quantityChange);
        item.recalculateAvailable();
        item.setUpdatedAt(Instant.now());
        inventoryItemRepository.save(item);

        InventoryTransactionEntity tx = new InventoryTransactionEntity();
        tx.setInventoryItemId(item.getId());
        tx.setProductId(item.getProductId());
        tx.setVariantId(item.getVariantId());
        tx.setType(quantityChange > 0 ? "restock" : "adjustment");
        tx.setQuantity(quantityChange);
        tx.setPreviousOnHand(previousOnHand);
        tx.setNewOnHand(item.getQuantityOnHand());
        tx.setNote(note);
        tx.setActorId(actorId);
        tx.setActorType("admin");
        transactionRepository.save(tx);

        syncProductStock(item.getProductId());
        broadcastLowStockIfNeeded(item.getProductId());
        return item;
    }

    /**
     * Sets on-hand to an absolute value (e.g. after physical stock count). Records one transaction with the delta.
     */
    public InventoryItemEntity setStockAbsolute(String inventoryItemId, int newQuantity, String note, String actorId) {
        InventoryItemEntity item = inventoryItemRepository.findById(inventoryItemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found"));
        if (newQuantity < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock quantity cannot be negative");
        }
        int previousOnHand = item.getQuantityOnHand() == null ? 0 : item.getQuantityOnHand();
        int delta = newQuantity - previousOnHand;
        item.setQuantityOnHand(newQuantity);
        item.recalculateAvailable();
        item.setUpdatedAt(Instant.now());
        inventoryItemRepository.save(item);

        InventoryTransactionEntity tx = new InventoryTransactionEntity();
        tx.setInventoryItemId(item.getId());
        tx.setProductId(item.getProductId());
        tx.setVariantId(item.getVariantId());
        tx.setType(delta >= 0 ? "restock" : "adjustment");
        tx.setQuantity(delta);
        tx.setPreviousOnHand(previousOnHand);
        tx.setNewOnHand(item.getQuantityOnHand());
        tx.setNote(note != null && !note.isBlank() ? note : "Set absolute quantity");
        tx.setActorId(actorId);
        tx.setActorType("admin");
        transactionRepository.save(tx);

        syncProductStock(item.getProductId());
        broadcastLowStockIfNeeded(item.getProductId());
        return item;
    }

    /** True when this product has at least one {@code inventory_items} row (warehouse-tracked). */
    public boolean isInventoryTracked(String productId) {
        if (productId == null || productId.isBlank()) {
            return false;
        }
        List<InventoryItemEntity> items = inventoryItemRepository.findByProductId(productId.trim());
        return items != null && !items.isEmpty();
    }

    /**
     * When inventory rows exist, deduct from them and sync {@link com.oceanbazar.backend.entity.ProductEntity#getStock()}.
     *
     * @return {@code true} if deduction used inventory_items; {@code false} if there are no rows
     */
    public boolean tryDeductForPlacedOrder(String productId, int quantity, String orderId) {
        if (productId == null || productId.isBlank() || quantity <= 0) {
            return false;
        }
        List<InventoryItemEntity> items = inventoryItemRepository.findByProductId(productId.trim());
        if (items == null || items.isEmpty()) {
            return false;
        }
        InventoryItemEntity item = items.stream()
                .filter(i -> i.getQuantityAvailable() != null && i.getQuantityAvailable() >= quantity)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient stock for product"));

        int previousOnHand = item.getQuantityOnHand() == null ? 0 : item.getQuantityOnHand();
        item.setQuantityOnHand(Math.max(0, previousOnHand - quantity));
        item.recalculateAvailable();
        item.setUpdatedAt(Instant.now());
        inventoryItemRepository.save(item);

        InventoryTransactionEntity tx = new InventoryTransactionEntity();
        tx.setInventoryItemId(item.getId());
        tx.setProductId(item.getProductId());
        tx.setVariantId(item.getVariantId());
        tx.setOrderId(orderId);
        tx.setType("sale");
        tx.setQuantity(-quantity);
        tx.setPreviousOnHand(previousOnHand);
        tx.setNewOnHand(item.getQuantityOnHand());
        tx.setNote("Checkout");
        tx.setActorType("system");
        transactionRepository.save(tx);

        syncProductStock(item.getProductId());
        broadcastLowStockIfNeeded(item.getProductId());
        return true;
    }

    public InventoryReservationEntity reserveStock(String productId, String variantId, String orderId, String userId, int quantity) {
        List<InventoryItemEntity> items = inventoryItemRepository.findByProductId(productId);
        InventoryItemEntity item = items.stream().filter(i -> i.getQuantityAvailable() >= quantity).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient stock for reservation"));

        item.setQuantityReserved(item.getQuantityReserved() + quantity);
        item.recalculateAvailable();
        item.setUpdatedAt(Instant.now());
        inventoryItemRepository.save(item);

        InventoryReservationEntity reservation = new InventoryReservationEntity();
        reservation.setInventoryItemId(item.getId());
        reservation.setProductId(productId);
        reservation.setVariantId(variantId);
        reservation.setOrderId(orderId);
        reservation.setUserId(userId);
        reservation.setQuantity(quantity);
        reservation.setStatus("held");
        reservation.setExpiresAt(Instant.now().plus(30, ChronoUnit.MINUTES));
        return reservationRepository.save(reservation);
    }

    public void commitReservation(String orderId) {
        List<InventoryReservationEntity> reservations = reservationRepository.findByOrderId(orderId);
        for (InventoryReservationEntity res : reservations) {
            if (!"held".equals(res.getStatus())) continue;
            res.setStatus("committed");
            res.setUpdatedAt(Instant.now());
            reservationRepository.save(res);

            InventoryItemEntity item = inventoryItemRepository.findById(res.getInventoryItemId()).orElse(null);
            if (item != null) {
                item.setQuantityReserved(Math.max(0, item.getQuantityReserved() - res.getQuantity()));
                item.setQuantityOnHand(Math.max(0, item.getQuantityOnHand() - res.getQuantity()));
                item.recalculateAvailable();
                item.setUpdatedAt(Instant.now());
                inventoryItemRepository.save(item);

                InventoryTransactionEntity tx = new InventoryTransactionEntity();
                tx.setInventoryItemId(item.getId());
                tx.setProductId(item.getProductId());
                tx.setOrderId(orderId);
                tx.setType("sale");
                tx.setQuantity(-res.getQuantity());
                tx.setPreviousOnHand(item.getQuantityOnHand() + res.getQuantity());
                tx.setNewOnHand(item.getQuantityOnHand());
                tx.setActorType("system");
                transactionRepository.save(tx);

                syncProductStock(item.getProductId());
                broadcastLowStockIfNeeded(item.getProductId());
            }
        }
    }

    public void releaseReservation(String orderId) {
        List<InventoryReservationEntity> reservations = reservationRepository.findByOrderId(orderId);
        for (InventoryReservationEntity res : reservations) {
            if (!"held".equals(res.getStatus())) continue;
            res.setStatus("released");
            res.setUpdatedAt(Instant.now());
            reservationRepository.save(res);

            InventoryItemEntity item = inventoryItemRepository.findById(res.getInventoryItemId()).orElse(null);
            if (item != null) {
                item.setQuantityReserved(Math.max(0, item.getQuantityReserved() - res.getQuantity()));
                item.recalculateAvailable();
                item.setUpdatedAt(Instant.now());
                inventoryItemRepository.save(item);
            }
        }
    }

    public void releaseExpiredReservations() {
        List<InventoryReservationEntity> expired = reservationRepository.findByStatusAndExpiresAtBefore("held", Instant.now());
        for (InventoryReservationEntity res : expired) {
            res.setStatus("expired");
            res.setUpdatedAt(Instant.now());
            reservationRepository.save(res);

            InventoryItemEntity item = inventoryItemRepository.findById(res.getInventoryItemId()).orElse(null);
            if (item != null) {
                item.setQuantityReserved(Math.max(0, item.getQuantityReserved() - res.getQuantity()));
                item.recalculateAvailable();
                item.setUpdatedAt(Instant.now());
                inventoryItemRepository.save(item);
            }
        }
    }

    public List<InventoryTransactionEntity> getTransactionHistory(String productId) {
        return transactionRepository.findByProductIdOrderByCreatedAtDesc(productId);
    }

    private void syncProductStock(String productId) {
        List<InventoryItemEntity> items = inventoryItemRepository.findByProductId(productId);
        int totalAvailable = items.stream().mapToInt(InventoryItemEntity::getQuantityAvailable).sum();
        productRepository.findById(productId).ifPresent(p -> {
            p.setStock(totalAvailable);
            productRepository.save(p);
        });
    }

    private void broadcastLowStockIfNeeded(String productId) {
        List<InventoryItemEntity> items = inventoryItemRepository.findByProductId(productId);
        if (items == null || items.isEmpty()) {
            return;
        }
        int totalAvailable = items.stream().mapToInt(i -> i.getQuantityAvailable() == null ? 0 : i.getQuantityAvailable()).sum();
        int threshold = items.stream()
                .mapToInt(i -> i.getReorderPoint() != null ? i.getReorderPoint() : lowStockBroadcastThreshold)
                .min()
                .orElse(lowStockBroadcastThreshold);
        if (totalAvailable <= threshold) {
            webSocketBroadcastService.broadcastInventoryAlert(productId, Map.of(
                    "productId", productId,
                    "available", totalAvailable,
                    "threshold", threshold,
                    "at", System.currentTimeMillis()
            ));
        }
    }
}
