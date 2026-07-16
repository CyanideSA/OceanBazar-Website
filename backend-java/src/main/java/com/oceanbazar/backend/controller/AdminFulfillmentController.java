package com.oceanbazar.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/fulfillment")
public class AdminFulfillmentController {
    /**
     * Courier fulfillment is owned by the Node BFF. Direct Java calls are
     * rejected so stub courier adapters cannot create a second source of truth.
     */
    @RequestMapping(path = {"", "/**"})
    public ResponseEntity<Map<String, Object>> nodeBffOnly() {
        return ResponseEntity.status(HttpStatus.GONE).body(Map.of(
                "error", "FULFILLMENT_MOVED_TO_NODE_BFF",
                "message", "Use the public Node BFF /api/admin/fulfillment endpoint"
        ));
    }
}
