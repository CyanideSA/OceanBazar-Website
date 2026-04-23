package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.AdminOrderDtos;
import com.oceanbazar.backend.entity.AuditLogEntity;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.PaymentTransactionEntity;
import com.oceanbazar.backend.entity.enums.ActorType;
import com.oceanbazar.backend.entity.enums.OrderStatus;
import com.oceanbazar.backend.entity.enums.PaymentStatus;
import com.oceanbazar.backend.entity.enums.PaymentTxStatus;
import com.oceanbazar.backend.utils.PaymentParsing;
import com.oceanbazar.backend.utils.ShortId;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.AuditLogRepository;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.ProductRepository;
import com.oceanbazar.backend.repository.UserRepository;
import com.oceanbazar.backend.repository.PaymentTransactionRepository;
import com.oceanbazar.backend.events.DomainEventPublisher;
import com.oceanbazar.backend.events.OrderPaymentChangedEvent;
import com.oceanbazar.backend.events.OrderStatusChangedEvent;
import com.oceanbazar.backend.events.OrderTrackingChangedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class AdminOrderCommandService {
    private static final java.util.Set<PaymentStatus> ALLOWED_PAYMENT_STATUSES = java.util.Set.of(
            PaymentStatus.unpaid, PaymentStatus.partial, PaymentStatus.paid, PaymentStatus.refunded);
    private static final java.util.Map<String, java.util.Set<String>> ORDER_STATUS_TRANSITIONS = java.util.Map.of(
            "pending", java.util.Set.of("confirmed", "cancelled"),
            "confirmed", java.util.Set.of("processing", "cancelled"),
            "processing", java.util.Set.of("shipped", "cancelled"),
            "shipped", java.util.Set.of("delivered"),
            "delivered", java.util.Set.of("returned"),
            "returned", java.util.Set.of(),
            "cancelled", java.util.Set.of()
    );

    private final OrderRepository orderRepository;
    private final CustomerNotificationService customerNotificationService;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final AdminAlertService adminAlertService;
    private final AdminUserRepository adminUserRepository;
    private final AuditLogRepository auditLogRepository;
    private final DomainEventPublisher domainEventPublisher;

    public Map<String, Object> updateOrderStatus(String actorAdminId, String orderId, AdminOrderDtos.AdminOrderStatusUpdateRequest req) {
        if (actorAdminId == null || actorAdminId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin actor");
        }
        if (req == null || req.getStatus() == null || req.getStatus().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status is required");
        }

        OrderStatus next;
        try {
            next = OrderStatus.valueOf(req.getStatus().trim().toLowerCase().replace("-", "_").replace(' ', '_'));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid order status");
        }
        String normalized = next.name();
        String note = req.getNote();
        if (note != null && note.isBlank()) note = null;

        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        String current = order.getStatus() != null
                ? order.getStatus().name()
                : OrderStatus.pending.name();
        ensureOrderTransitionAllowed(current, normalized);

        if (!Objects.equals(current, normalized)) {
            OrderTimelineSupport.recordStatusTransition(order, current, normalized, note, actorAdminId, ActorType.admin);
        }
        order.setStatus(next);
        orderRepository.save(order);

        logAction(actorAdminId, "UPDATE_ORDER_STATUS", "order", order.getId(),
                "from=" + current + " to=" + normalized
                        + (note != null ? " note=" + truncateAudit(note, 160) : ""));

        if (order.getUserId() != null && !order.getUserId().isBlank()) {
            String ref = order.getOrderNumber() != null && !order.getOrderNumber().isBlank()
                    ? order.getOrderNumber()
                    : order.getId();
            customerNotificationService.notifyCustomer(
                    order.getUserId(),
                    "Order status updated",
                    "Order " + ref + " is now " + normalized + ".",
                    "order",
                    order.getId()
            );
            domainEventPublisher.publish(new OrderStatusChangedEvent(
                    order.getUserId(), order.getId(), ref, normalized));
        }

        return Map.of("success", true, "orderId", order.getId(), "status", normalized);
    }

    public Map<String, Object> updatePaymentStatus(String actorAdminId, String orderId, AdminOrderDtos.AdminPaymentStatusUpdateRequest req) {
        if (actorAdminId == null || actorAdminId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin actor");
        }
        if (req == null || req.getPaymentStatus() == null || req.getPaymentStatus().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "paymentStatus is required");
        }

        String normalized = req.getPaymentStatus().trim().toLowerCase();
        PaymentStatus nextPs = PaymentParsing.parseOrderPaymentStatusWire(normalized);
        if (!ALLOWED_PAYMENT_STATUSES.contains(nextPs)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payment status");
        }

        String payNote = req.getNote();
        if (payNote != null && payNote.isBlank()) payNote = null;

        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        PaymentStatus previousPs = order.getPaymentStatus() != null ? order.getPaymentStatus() : PaymentStatus.unpaid;
        String currentPayment = previousPs.name();
        ensurePaymentTransitionAllowed(previousPs, nextPs);
        if (!Objects.equals(previousPs, nextPs)) {
            OrderTimelineSupport.recordPaymentChange(order, nextPs.name(), payNote, actorAdminId, ActorType.admin);
        }
        order.setPaymentStatus(nextPs);
        orderRepository.save(order);

        PaymentTxStatus txStatus = mapToPaymentTxStatus(nextPs.name());
        PaymentTransactionEntity tx = paymentTransactionRepository
                .findTopByOrderIdOrderByCreatedAtDesc(order.getId())
                .orElseGet(() -> {
                    PaymentTransactionEntity t = new PaymentTransactionEntity();
                    t.setId(ShortId.newId8());
                    t.setOrderId(order.getId());
                    t.setUserId(order.getUserId());
                    t.setMethod(order.getPaymentMethod());
                    t.setStatus(PaymentTxStatus.pending);
                    t.setProviderTxId(order.getTrackingNumber());
                    t.setAmount(order.getTotal());
                    t.setCurrency("BDT");
                    t.setCreatedAt(Instant.now());
                    return t;
                });

        tx.setMethod(order.getPaymentMethod());
        tx.setProviderTxId(order.getTrackingNumber());
        tx.setAmount(order.getTotal() == null ? tx.getAmount() : order.getTotal());
        if (!Objects.equals(tx.getStatus(), txStatus)) {
            tx.setStatus(txStatus);
        }
        paymentTransactionRepository.save(tx);

        logAction(actorAdminId, "UPDATE_PAYMENT_STATUS", "order", order.getId(),
                "paymentStatus=" + nextPs.name()
                        + (payNote != null ? " note=" + truncateAudit(payNote, 160) : ""));

        if (!Objects.equals(currentPayment, nextPs.name())) {
            adminAlertService.notifyPaymentChanged(order, currentPayment, nextPs.name(), tx.getId());
        }

        if (order.getUserId() != null && !order.getUserId().isBlank()) {
            String ref = order.getOrderNumber() != null && !order.getOrderNumber().isBlank()
                    ? order.getOrderNumber()
                    : order.getId();
            customerNotificationService.notifyCustomer(
                    order.getUserId(),
                    "Payment status updated",
                    "Payment for order " + ref + " is now " + nextPs.name() + ".",
                    "payment",
                    order.getId()
            );
            domainEventPublisher.publish(new OrderPaymentChangedEvent(
                    order.getUserId(), order.getId(), ref, nextPs.name()));
        }

        return Map.of("success", true, "orderId", order.getId(), "paymentStatus", nextPs.name());
    }

    public Map<String, Object> updateOrderTracking(String actorAdminId, String orderId, AdminOrderDtos.AdminOrderTrackingUpdateRequest req) {
        if (actorAdminId == null || actorAdminId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin actor");
        }
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }

        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        String incoming = req.getTrackingNumber() == null ? "" : req.getTrackingNumber().trim();
        String normalizedTn = incoming.isEmpty() ? null : incoming;
        String note = req.getNote();
        if (note != null && note.isBlank()) {
            note = null;
        }

        String prevRaw = order.getTrackingNumber();
        String prevNorm = prevRaw == null || prevRaw.isBlank() ? null : prevRaw.trim();
        if (java.util.Objects.equals(prevNorm, normalizedTn)) {
            return Map.of("success", true, "orderId", order.getId(), "trackingNumber",
                    order.getTrackingNumber() == null ? "" : order.getTrackingNumber());
        }

        OrderTimelineSupport.recordTrackingChange(order, prevNorm, normalizedTn, note, actorAdminId);
        order.setTrackingNumber(normalizedTn);
        orderRepository.save(order);

        String auditPrev = prevNorm == null ? "∅" : prevNorm;
        String auditNext = normalizedTn == null ? "∅" : normalizedTn;
        logAction(actorAdminId, "UPDATE_ORDER_TRACKING", "order", order.getId(),
                "tracking " + auditPrev + " → " + auditNext + (note != null ? " note=" + truncateAudit(note, 160) : ""));

        if (order.getUserId() != null && !order.getUserId().isBlank()) {
            String ref = order.getOrderNumber() != null && !order.getOrderNumber().isBlank()
                    ? order.getOrderNumber()
                    : order.getId();
            String tn = normalizedTn == null ? "Not set yet" : normalizedTn;
            customerNotificationService.notifyCustomer(
                    order.getUserId(),
                    "Tracking updated",
                    "Tracking for order " + ref + ": " + tn,
                    "order",
                    order.getId()
            );
            domainEventPublisher.publish(new OrderTrackingChangedEvent(
                    order.getUserId(), order.getId(), ref, normalizedTn == null ? "" : normalizedTn));
        }

        return Map.of("success", true, "orderId", order.getId(), "trackingNumber",
                order.getTrackingNumber() == null ? "" : order.getTrackingNumber());
    }

    private static PaymentTxStatus mapToPaymentTxStatus(String orderPaymentStatus) {
        if (orderPaymentStatus == null || orderPaymentStatus.isBlank()) return PaymentTxStatus.pending;
        return switch (orderPaymentStatus.trim().toLowerCase()) {
            case "paid", "partial" -> PaymentTxStatus.success;
            case "failed" -> PaymentTxStatus.failed;
            case "refunded" -> PaymentTxStatus.refunded;
            default -> PaymentTxStatus.pending;
        };
    }

    private static String truncateAudit(String s, int max) {
        if (s.length() <= max) {
            return s;
        }
        return s.substring(0, max) + "…";
    }

    private void ensureOrderTransitionAllowed(String current, String next) {
        if (Objects.equals(current, next)) return;
        java.util.Set<String> allowed = ORDER_STATUS_TRANSITIONS.getOrDefault(current, java.util.Set.of());
        if (!allowed.contains(next)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid order status transition: " + current + " -> " + next
            );
        }
    }

    private void ensurePaymentTransitionAllowed(PaymentStatus current, PaymentStatus next) {
        if (Objects.equals(current, next)) return;
        if (!ALLOWED_PAYMENT_STATUSES.contains(next)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payment status");
        }
    }

    private void logAction(String adminId, String action, String targetType, String targetId, String details) {
        AuditLogEntity log = new AuditLogEntity();
        log.setAdminId(Integer.valueOf(adminId));
        log.setAction(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setDetails(details);
        auditLogRepository.save(log);
    }
}
