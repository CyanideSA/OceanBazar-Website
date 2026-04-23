package com.oceanbazar.backend.events;

import com.oceanbazar.backend.service.CustomerNotificationHub;
import com.oceanbazar.backend.service.WebSocketBroadcastService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Maps domain events to customer real-time (STOMP) and admin STOMP fan-out.
 */
@Component
@RequiredArgsConstructor
public class RealtimeFanOutListener {
    private final CustomerNotificationHub customerNotificationHub;
    private final WebSocketBroadcastService webSocketBroadcastService;

    @EventListener
    public void onOrderPlaced(OrderPlacedEvent e) {
        customerNotificationHub.publishOrderUpdate(e.userId(), Map.of(
                "orderId", e.orderId(),
                "orderNumber", e.orderNumber() != null ? e.orderNumber() : "",
                "status", e.status() != null ? e.status() : ""
        ));
    }

    @EventListener
    public void onOrderStatusChanged(OrderStatusChangedEvent e) {
        if (e.userId() == null || e.userId().isBlank()) {
            return;
        }
        customerNotificationHub.publishOrderUpdate(e.userId(), Map.of(
                "orderId", e.orderId(),
                "orderNumber", e.orderNumber() != null ? e.orderNumber() : "",
                "status", e.status() != null ? e.status() : ""
        ));
    }

    @EventListener
    public void onOrderPaymentChanged(OrderPaymentChangedEvent e) {
        if (e.userId() == null || e.userId().isBlank()) {
            return;
        }
        customerNotificationHub.publishOrderUpdate(e.userId(), Map.of(
                "orderId", e.orderId(),
                "orderNumber", e.orderNumber() != null ? e.orderNumber() : "",
                "status", "",
                "paymentStatus", e.paymentStatus() != null ? e.paymentStatus() : ""
        ));
    }

    @EventListener
    public void onOrderTrackingChanged(OrderTrackingChangedEvent e) {
        if (e.userId() == null || e.userId().isBlank()) {
            return;
        }
        customerNotificationHub.publishOrderUpdate(e.userId(), Map.of(
                "orderId", e.orderId(),
                "orderNumber", e.orderNumber() != null ? e.orderNumber() : "",
                "trackingNumber", e.trackingNumber() != null ? e.trackingNumber() : ""
        ));
    }

    @EventListener
    public void onReturnSubmitted(ReturnSubmittedEvent e) {
        customerNotificationHub.publishReturnUpdate(e.userId(), Map.of(
                "orderId", e.orderId(),
                "returnRequestId", e.returnRequestId() != null ? e.returnRequestId() : "",
                "disputeId", e.disputeId() != null ? e.disputeId() : "",
                "status", "pending"
        ));
        webSocketBroadcastService.broadcastReturnUpdate(Map.of(
                "type", "return_submitted",
                "userId", e.userId() != null ? e.userId() : "",
                "orderId", e.orderId() != null ? e.orderId() : "",
                "returnRequestId", e.returnRequestId() != null ? e.returnRequestId() : "",
                "status", "pending"
        ));
    }

    @EventListener
    public void onReturnStatusChanged(ReturnStatusChangedEvent e) {
        if (e.userId() == null || e.userId().isBlank()) {
            return;
        }
        customerNotificationHub.publishReturnUpdate(e.userId(), Map.of(
                "orderId", e.orderId(),
                "returnRequestId", e.returnRequestId() != null ? e.returnRequestId() : "",
                "status", e.status() != null ? e.status() : ""
        ));
        webSocketBroadcastService.broadcastReturnUpdate(Map.of(
                "type", "return_status_changed",
                "userId", e.userId(),
                "orderId", e.orderId() != null ? e.orderId() : "",
                "returnRequestId", e.returnRequestId() != null ? e.returnRequestId() : "",
                "status", e.status() != null ? e.status() : ""
        ));
    }

    @EventListener
    public void onCustomerChatMessage(CustomerChatMessageEvent e) {
        webSocketBroadcastService.broadcastChatUpdate(Map.of(
                "type", "customer_message",
                "userId", e.userId(),
                "sessionId", e.sessionId()
        ));
    }
}
