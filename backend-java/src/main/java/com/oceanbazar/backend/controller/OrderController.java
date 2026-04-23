package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.CartDtos;
import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.dto.OrderDtos;
import com.oceanbazar.backend.service.CartService;
import com.oceanbazar.backend.service.OrderService;
import com.oceanbazar.backend.service.OrderQueryService;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {
    private final AuthTokenService authTokenService;
    private final OrderService orderService;
    private final OrderQueryService orderQueryService;
    private final CartService cartService;

    @PostMapping("/place")
    public Map<String, Object> placeOrder(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @org.springframework.web.bind.annotation.RequestBody OrderDtos.PlaceOrderRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return orderService.placeOrder(userId, request);
    }

    @GetMapping("/dashboard-stats")
    public OrderDtos.OrderDashboardStatsDto getDashboardStats(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return orderQueryService.getDashboardStats(userId);
    }

    @GetMapping("/recent")
    public OrderDtos.RecentOrdersResponseDto getRecentOrders(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(defaultValue = "5") int limit
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return orderQueryService.getRecentOrders(userId, limit);
    }

    @GetMapping("")
    public OrderDtos.OrderListResponseDto getAllOrders(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return orderQueryService.getAllOrders(userId, status, page, limit);
    }

    @GetMapping("/{orderId}")
    public OrderDtos.OrderResponseDto getOrder(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String orderId
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return orderQueryService.getOrder(userId, orderId);
    }

    @GetMapping("/{orderId}/tracking")
    public OrderDtos.OrderTrackingResponseDto getOrderTracking(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String orderId
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return orderQueryService.getOrderTracking(userId, orderId);
    }

    @PostMapping("/{orderId}/feedback")
    public OrderDtos.OrderResponseDto submitOrderFeedback(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String orderId,
            @Valid @RequestBody OrderDtos.OrderFeedbackRequest body
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return orderService.submitBuyerFeedback(userId, orderId, body);
    }

    /** POST /api/orders/{orderId}/cancel — customer-initiated cancellation */
    @PostMapping("/{orderId}/cancel")
    public Map<String, Object> cancelOrder(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String orderId
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return orderService.cancelOrder(userId, orderId);
    }

    /**
     * Adds all line items from a completed/past order into the signed-in customer’s cart (same behaviour as
     * {@code POST /api/cart/reorder-from-order/{orderId}}).
     */
    @PostMapping("/{orderId}/reorder")
    public CartDtos.CartResponseDto reorderFromOrder(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String orderId
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return cartService.reorderFromOrder(userId, orderId);
    }
}
