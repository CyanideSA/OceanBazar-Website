package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.InventoryItemEntity;
import com.oceanbazar.backend.entity.InventoryTransactionEntity;
import com.oceanbazar.backend.repository.InventoryItemRepository;
import com.oceanbazar.backend.repository.InventoryReservationRepository;
import com.oceanbazar.backend.repository.InventoryTransactionRepository;
import com.oceanbazar.backend.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    @Mock private InventoryItemRepository inventoryItemRepository;
    @Mock private InventoryReservationRepository reservationRepository;
    @Mock private InventoryTransactionRepository transactionRepository;
    @Mock private ProductRepository productRepository;

    @InjectMocks private InventoryService inventoryService;

    private InventoryItemEntity sampleItem;

    @BeforeEach
    void setUp() {
        sampleItem = new InventoryItemEntity();
        sampleItem.setId("inv-1");
        sampleItem.setProductId("prod-1");
        sampleItem.setQuantityOnHand(100);
        sampleItem.setQuantityReserved(10);
        sampleItem.setQuantityAvailable(90);
        sampleItem.setStatus("in_stock");
    }

    @Test
    @DisplayName("adjustStock increases on-hand quantity and records transaction")
    void adjustStock_increase() {
        when(inventoryItemRepository.findById("inv-1")).thenReturn(Optional.of(sampleItem));
        when(inventoryItemRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(transactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(inventoryItemRepository.findByProductId("prod-1")).thenReturn(List.of(sampleItem));
        when(productRepository.findById("prod-1")).thenReturn(Optional.empty());

        InventoryItemEntity result = inventoryService.adjustStock("inv-1", 20, "Restock", "admin-1");

        assertEquals(120, result.getQuantityOnHand());
        verify(transactionRepository).save(any(InventoryTransactionEntity.class));
    }

    @Test
    @DisplayName("adjustStock decreases on-hand quantity correctly")
    void adjustStock_decrease() {
        when(inventoryItemRepository.findById("inv-1")).thenReturn(Optional.of(sampleItem));
        when(inventoryItemRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(transactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(inventoryItemRepository.findByProductId("prod-1")).thenReturn(List.of(sampleItem));
        when(productRepository.findById("prod-1")).thenReturn(Optional.empty());

        InventoryItemEntity result = inventoryService.adjustStock("inv-1", -30, "Damaged goods", "admin-1");

        assertEquals(70, result.getQuantityOnHand());
    }

    @Test
    @DisplayName("listLowStock delegates to repository")
    void listLowStock() {
        when(inventoryItemRepository.findByQuantityAvailableLessThanEqual(10)).thenReturn(List.of(sampleItem));

        List<InventoryItemEntity> result = inventoryService.listLowStock(10);

        assertFalse(result.isEmpty());
        verify(inventoryItemRepository).findByQuantityAvailableLessThanEqual(10);
    }
}
