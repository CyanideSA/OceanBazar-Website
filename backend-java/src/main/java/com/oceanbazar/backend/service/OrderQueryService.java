package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.OrderDtos;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.enums.OrderStatus;
import com.oceanbazar.backend.mapper.OrderMapper;
import com.oceanbazar.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class OrderQueryService {
    private final OrderRepository orderRepository;
    private final OrderTrackingService orderTrackingService;

    private static final Set<OrderStatus> PIPELINE_STATUSES = Set.of(
            OrderStatus.pending, OrderStatus.confirmed, OrderStatus.processing);

    public OrderDtos.OrderDashboardStatsDto getDashboardStats(String userId) {
        List<OrderEntity> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);

        int totalOrders = orders.size();
        double totalSpent = orders.stream().mapToDouble(o -> o.getTotal() == null ? 0.0 : o.getTotal().doubleValue()).sum();
        long pendingOrders = orders.stream()
                .filter(o -> o.getStatus() != null && PIPELINE_STATUSES.contains(o.getStatus()))
                .count();
        double avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0.0;

        OrderDtos.OrderDashboardStatsDto res = new OrderDtos.OrderDashboardStatsDto();
        res.setTotalOrders(totalOrders);
        res.setTotalSpent(Math.round(totalSpent * 100.0) / 100.0);
        res.setAvgOrderValue(Math.round(avgOrderValue * 100.0) / 100.0);
        res.setPendingOrders(pendingOrders);
        return res;
    }

    public OrderDtos.RecentOrdersResponseDto getRecentOrders(String userId, int limit) {
        List<OrderEntity> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
        int safeLimit = Math.max(limit, 0);

        List<OrderDtos.OrderResponseDto> normalized = orders.stream()
                .limit(safeLimit)
                .map(OrderMapper::toOrderResponse)
                .toList();

        OrderDtos.RecentOrdersResponseDto res = new OrderDtos.RecentOrdersResponseDto();
        res.setOrders(normalized);
        return res;
    }

    public OrderDtos.OrderListResponseDto getAllOrders(String userId, String status, int page, int limit) {
        List<OrderEntity> source = (status == null || status.isBlank())
                ? orderRepository.findByUserIdOrderByCreatedAtDesc(userId)
                : orderRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, parseOrderStatus(status));

        int safePage = Math.max(page, 1);
        int safeLimit = Math.max(limit, 1);
        int start = Math.min((safePage - 1) * safeLimit, source.size());
        int end = Math.min(start + safeLimit, source.size());

        List<OrderDtos.OrderResponseDto> orders = source.subList(start, end).stream()
                .map(OrderMapper::toOrderResponse)
                .toList();

        OrderDtos.OrderListResponseDto res = new OrderDtos.OrderListResponseDto();
        res.setOrders(orders);
        res.setTotal(source.size());
        res.setPage(safePage);
        res.setTotalPages((source.size() + safeLimit - 1) / safeLimit);
        return res;
    }

    private static OrderStatus parseOrderStatus(String status) {
        try {
            String n = status.trim().toLowerCase().replace('-', '_').replace(' ', '_');
            return OrderStatus.valueOf(n);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid order status filter");
        }
    }

    public OrderDtos.OrderResponseDto getOrder(String userId, String orderId) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (!userId.equals(order.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your order");
        }

        return OrderMapper.toOrderResponse(order);
    }

    public OrderDtos.OrderTrackingResponseDto getOrderTracking(String userId, String orderId) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!userId.equals(order.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your order");
        }
        return orderTrackingService.buildTracking(order);
    }
}
