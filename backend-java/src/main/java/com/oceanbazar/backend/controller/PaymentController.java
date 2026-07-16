package com.oceanbazar.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    /**
     * Payment gateway traffic is intentionally owned by the Node BFF.
     * Keeping a hard failure here prevents direct Java API access from bypassing
     * gateway session validation and marking an order as paid.
     */
    @RequestMapping(path = {"", "/**"})
    public ResponseEntity<Map<String, Object>> nodeBffOnly() {
        return ResponseEntity.status(HttpStatus.GONE).body(Map.of(
                "error", "PAYMENTS_MOVED_TO_NODE_BFF",
                "message", "Use the public Node BFF /api/payments endpoint"
        ));
    }
}

