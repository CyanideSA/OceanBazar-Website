package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.PaymentDtos;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.PaymentTransactionEntity;
import com.oceanbazar.backend.entity.enums.ActorType;
import com.oceanbazar.backend.entity.enums.OrderStatus;
import com.oceanbazar.backend.entity.enums.PaymentMethod;
import com.oceanbazar.backend.entity.enums.PaymentStatus;
import com.oceanbazar.backend.entity.enums.PaymentTxStatus;
import com.oceanbazar.backend.payments.PaymentGateway;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.PaymentTransactionRepository;
import com.oceanbazar.backend.utils.PaymentParsing;
import com.oceanbazar.backend.utils.ShortId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
public class PaymentService {
    private final OrderRepository orderRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final AdminAlertService adminAlertService;
    private final CustomerNotificationService customerNotificationService;
    private final Map<String, PaymentGateway> gatewaysByProvider;
    private final PaymentGateway genericGateway;

    public PaymentService(
            OrderRepository orderRepository,
            PaymentTransactionRepository paymentTransactionRepository,
            AdminAlertService adminAlertService,
            CustomerNotificationService customerNotificationService,
            List<PaymentGateway> gateways
    ) {
        this.orderRepository = orderRepository;
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.adminAlertService = adminAlertService;
        this.customerNotificationService = customerNotificationService;

        HashMap<String, PaymentGateway> map = new HashMap<>();
        PaymentGateway generic = null;
        for (PaymentGateway g : gateways) {
            if (g == null) continue;
            map.put(g.providerKey(), g);
            if ("placeholder".equalsIgnoreCase(g.providerKey())) {
                generic = g;
            }
        }
        this.gatewaysByProvider = map;
        this.genericGateway = generic;
    }

    public Map<String, Object> authorizePlaceholder(String userId, PaymentDtos.PaymentPlaceholderRequest request) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing user id");
        }
        if (request == null || request.getOrderId() == null || request.getOrderId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "orderId required");
        }

        OrderEntity order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!userId.equals(order.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your order");
        }

        String normalizedMethod = request.getPaymentMethod() == null
                ? "placeholder"
                : request.getPaymentMethod().trim().toLowerCase();

        PaymentGateway gateway = gatewaysByProvider.getOrDefault(normalizedMethod, genericGateway);
        if (gateway == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported payment method");
        }

        PaymentMethod pm = PaymentParsing.parsePaymentMethod(normalizedMethod);
        order.setPaymentMethod(pm);

        Optional<PaymentTransactionEntity> existingOpt =
                paymentTransactionRepository.findTopByOrderIdAndMethodOrderByCreatedAtDesc(order.getId(), pm);

        if (existingOpt.isPresent()) {
            PaymentTransactionEntity existing = existingOpt.get();
            PaymentTxStatus existingStatus = existing.getStatus() != null
                    ? existing.getStatus()
                    : PaymentTxStatus.pending;

            if (existingStatus == PaymentTxStatus.success) {
                order.setPaymentStatus(PaymentStatus.paid);
                if (existing.getProviderTxId() != null && !existing.getProviderTxId().isBlank()) {
                    order.setTrackingNumber(existing.getProviderTxId());
                }
                paymentTransactionRepository.save(existing);
                orderRepository.save(order);

                return Map.of(
                        "success", true,
                        "orderId", order.getId(),
                        "paymentStatus", "paid",
                        "trackingNumber", order.getTrackingNumber(),
                        "transactionId", existing.getId(),
                        "providerTransactionId", existing.getProviderTxId()
                );
            }

            if (existingStatus != PaymentTxStatus.failed
                    && existingStatus != PaymentTxStatus.refunded) {
                PaymentTransactionEntity tx = existing;
                applyPlaceholderPaymentAndFinalize(order, tx, normalizedMethod, gateway, userId);
                return Map.of(
                        "success", true,
                        "orderId", order.getId(),
                        "paymentStatus", order.getPaymentStatus() != null ? order.getPaymentStatus().name() : "pending",
                        "trackingNumber", order.getTrackingNumber(),
                        "transactionId", tx.getId(),
                        "providerTransactionId", tx.getProviderTxId()
                );
            }
        }

        PaymentTransactionEntity tx = new PaymentTransactionEntity();
        tx.setId(ShortId.newId8());
        tx.setOrderId(order.getId());
        tx.setUserId(order.getUserId());
        tx.setMethod(order.getPaymentMethod());
        tx.setStatus(PaymentTxStatus.pending);
        tx.setAmount(order.getTotal() == null ? BigDecimal.ZERO : order.getTotal());
        tx.setProviderTxId(order.getTrackingNumber());
        tx.setCurrency("BDT");
        tx.setMetadata("{\"provider\":\"" + normalizedMethod + "\",\"mode\":\"placeholder\"}");
        tx.setCreatedAt(Instant.now());

        paymentTransactionRepository.save(tx);

        applyPlaceholderPaymentAndFinalize(order, tx, normalizedMethod, gateway, userId);

        return Map.of(
                "success", true,
                "orderId", order.getId(),
                "paymentStatus", order.getPaymentStatus() != null ? order.getPaymentStatus().name() : "pending",
                "trackingNumber", order.getTrackingNumber(),
                "transactionId", tx.getId(),
                "providerTransactionId", tx.getProviderTxId()
        );
    }

    private void applyPlaceholderPaymentAndFinalize(
            OrderEntity order,
            PaymentTransactionEntity tx,
            String normalizedMethod,
            PaymentGateway gateway,
            String actor
    ) {
        String payBefore = order.getPaymentStatus() != null ? order.getPaymentStatus().name() : "unpaid";
        try {
            OrderStatus fromStatus = order.getStatus() != null ? order.getStatus() : OrderStatus.pending;
            OrderStatus toStatus = OrderStatus.processing;
            if (fromStatus != toStatus) {
                OrderTimelineSupport.recordStatusTransition(order,
                        fromStatus.name(), toStatus.name(),
                        "Payment authorized (placeholder)", actor, ActorType.customer);
                order.setStatus(toStatus);
            }

            gateway.applySuccessfulPlaceholderPayment(order);

            String payAfter = order.getPaymentStatus() != null ? order.getPaymentStatus().name() : null;
            if (payAfter != null && !payAfter.equals(payBefore)) {
                OrderTimelineSupport.recordPaymentChange(order, payAfter, "Payment authorized (placeholder)", actor, ActorType.customer);
            }

            PaymentTxStatus txStatus = mapToPaymentTxStatus(payAfter);
            tx.setProviderTxId(order.getTrackingNumber());
            tx.setMethod(order.getPaymentMethod());
            tx.setAmount(order.getTotal() == null ? tx.getAmount() : order.getTotal());
            if (tx.getMetadata() == null) {
                tx.setMetadata("{\"provider\":\"" + normalizedMethod + "\",\"mode\":\"placeholder\"}");
            }
            tx.setStatus(txStatus);

            orderRepository.save(order);
            paymentTransactionRepository.save(tx);

            if (!Objects.equals(payBefore, payAfter)) {
                adminAlertService.notifyPaymentChanged(order, payBefore, payAfter, tx.getId());
            }

            if (PaymentStatus.paid.equals(order.getPaymentStatus()) && order.getUserId() != null) {
                String ref = order.getOrderNumber() != null && !order.getOrderNumber().isBlank()
                        ? order.getOrderNumber()
                        : order.getId();
                customerNotificationService.notifyCustomer(
                        order.getUserId(),
                        "Payment successful",
                        "Payment for order " + ref + " was received. Thank you.",
                        "payment",
                        order.getId()
                );
            }
        } catch (Exception ex) {
            order.setPaymentStatus(PaymentStatus.unpaid);
            OrderTimelineSupport.recordPaymentChange(order, "unpaid", "Payment authorization failed", actor, ActorType.customer);
            orderRepository.save(order);
            tx.setStatus(PaymentTxStatus.failed);
            paymentTransactionRepository.save(tx);
            if (order.getUserId() != null) {
                String ref = order.getOrderNumber() != null && !order.getOrderNumber().isBlank()
                        ? order.getOrderNumber()
                        : order.getId();
                customerNotificationService.notifyCustomer(
                        order.getUserId(),
                        "Payment failed",
                        "We could not complete payment for order " + ref + ". Please try again or use another method.",
                        "payment",
                        order.getId()
                );
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Payment authorization failed");
        }
    }

    private static PaymentTxStatus mapToPaymentTxStatus(String orderPaymentStatus) {
        if (orderPaymentStatus == null || orderPaymentStatus.isBlank()) return PaymentTxStatus.pending;
        PaymentStatus ps = PaymentParsing.parseOrderPaymentStatusWire(orderPaymentStatus);
        return switch (ps) {
            case paid, partial -> PaymentTxStatus.success;
            case refunded -> PaymentTxStatus.refunded;
            case unpaid -> PaymentTxStatus.pending;
        };
    }
}
