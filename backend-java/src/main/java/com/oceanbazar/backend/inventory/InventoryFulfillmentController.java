package com.oceanbazar.backend.inventory;

import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.service.InventoryService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryFulfillmentController {

    private final AuthTokenService authTokenService;
    private final InventoryService inventoryService;

    /**
     * Deduct warehouse-tracked stock after BFF persists the order (single source: InventoryService).
     */
    @PostMapping("/fulfill-placed-order")
    public Map<String, Object> fulfillPlacedOrder(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody FulfillOrderRequest request
    ) {
        authTokenService.getUserIdFromAuthorization(authorization);
        int fulfilled = 0;
        for (LineItem line : request.lines) {
            if (inventoryService.tryDeductForPlacedOrder(line.productId, line.quantity, request.orderId)) {
                fulfilled++;
            }
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("orderId", request.orderId);
        res.put("linesProcessed", request.lines.size());
        res.put("inventoryRowsUpdated", fulfilled);
        return res;
    }

    @Data
    public static class FulfillOrderRequest {
        @NotBlank
        private String orderId;
        @NotEmpty
        private List<LineItem> lines;
    }

    @Data
    public static class LineItem {
        @NotBlank
        private String productId;
        private String variantId;
        @Min(1)
        private int quantity = 1;
    }
}
