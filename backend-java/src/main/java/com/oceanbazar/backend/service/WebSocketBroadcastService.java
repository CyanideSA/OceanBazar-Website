package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.NotificationEntity;
import com.oceanbazar.backend.observability.RealtimeMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketBroadcastService {
    private final SimpMessagingTemplate messagingTemplate;
    private final RealtimeMetrics realtimeMetrics;

    public void broadcastOrderUpdate(String orderId, Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/orders/" + orderId, payload);
        messagingTemplate.convertAndSend("/topic/admin/orders", payload);
        realtimeMetrics.stompAdminMessages.increment();
        log.debug("Broadcast order update: {}", orderId);
    }

    public void broadcastInventoryAlert(String productId, Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/admin/inventory", payload);
        realtimeMetrics.stompAdminMessages.increment();
        log.debug("Broadcast inventory alert: {}", productId);
    }

    public void broadcastNewReview(String productId, Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/admin/reviews", payload);
        messagingTemplate.convertAndSend("/topic/products/" + productId + "/reviews", payload);
        realtimeMetrics.stompAdminMessages.increment();
    }

    public void broadcastNotification(String userId, Map<String, Object> payload) {
        if (userId == null || userId.isBlank()) {
            return;
        }
        messagingTemplate.convertAndSendToUser(userId.trim(), "/queue/notifications", payload);
        realtimeMetrics.stompCustomerNotifications.increment();
        log.debug("STOMP customer notification -> user {}", userId);
    }

    /** Real-time order activity for the storefront (same queue as inbox; discriminated by {@code _event}). */
    public void pushCustomerOrderStream(String userId, Map<String, Object> payload) {
        if (userId == null || userId.isBlank() || payload == null) {
            return;
        }
        Map<String, Object> m = new LinkedHashMap<>(payload);
        m.put("_event", "order_update");
        messagingTemplate.convertAndSendToUser(userId.trim(), "/queue/notifications", m);
        realtimeMetrics.stompCustomerNotifications.increment();
    }

    /** Real-time return/RMA activity for the storefront. */
    public void pushCustomerReturnStream(String userId, Map<String, Object> payload) {
        if (userId == null || userId.isBlank() || payload == null) {
            return;
        }
        Map<String, Object> m = new LinkedHashMap<>(payload);
        m.put("_event", "return_update");
        messagingTemplate.convertAndSendToUser(userId.trim(), "/queue/notifications", m);
        realtimeMetrics.stompCustomerNotifications.increment();
    }

    /** Push a persisted customer {@link NotificationEntity} to {@code /user/queue/notifications}. */
    public void pushCustomerInbox(NotificationEntity n) {
        if (n == null || n.getUserId() == null || n.getUserId().isBlank()) {
            return;
        }
        broadcastNotification(n.getUserId().trim(), toCustomerNotificationPayload(n));
    }

    /**
     * Lightweight hint so the storefront refetches inbox / unread count (e.g. after mark-read).
     * Does not increment customer-notification metrics.
     */
    public void pushInboxRefreshHint(String userId) {
        if (userId == null || userId.isBlank()) {
            return;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("_event", "inbox_refresh");
        messagingTemplate.convertAndSendToUser(userId.trim(), "/queue/notifications", m);
        log.debug("STOMP inbox_refresh hint -> user {}", userId);
    }

    private static Map<String, Object> toCustomerNotificationPayload(NotificationEntity n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", n.getId() != null ? n.getId() : "");
        m.put("userId", n.getUserId() != null ? n.getUserId() : "");
        m.put("title", n.getTitle() != null ? n.getTitle() : "");
        m.put("message", n.getMessage() != null ? n.getMessage() : "");
        if (n.getImage() != null && !n.getImage().isBlank()) {
            m.put("image", n.getImage());
        }
        boolean read = Boolean.TRUE.equals(n.getReadStatus());
        m.put("readStatus", read);
        m.put("read", read);
        m.put("createdAt", n.getCreatedAt() != null ? n.getCreatedAt().toEpochMilli() : System.currentTimeMillis());
        m.put("kind", n.getKind() != null ? n.getKind() : "system");
        m.put("entityId", n.getEntityId() != null ? n.getEntityId() : "");
        return m;
    }

    public void broadcastAdminAlert(Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/admin/alerts", payload);
        realtimeMetrics.stompAdminMessages.increment();
    }

    public void broadcastPaymentUpdate(String orderId, Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/orders/" + orderId + "/payment", payload);
        messagingTemplate.convertAndSend("/topic/admin/payments", payload);
        realtimeMetrics.stompAdminMessages.increment();
    }

    public void broadcastChatUpdate(Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/admin/chats", payload);
        realtimeMetrics.stompAdminMessages.increment();
    }

    public void broadcastReturnUpdate(Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/admin/returns", payload);
        realtimeMetrics.stompAdminMessages.increment();
    }

    /** Full session snapshot for the storefront widget ({@code /user/queue/chat}). */
    public void pushCustomerChat(String userId, Map<String, Object> sessionPayload) {
        if (userId == null || userId.isBlank() || sessionPayload == null) {
            return;
        }
        messagingTemplate.convertAndSendToUser(userId.trim(), "/queue/chat", sessionPayload);
        realtimeMetrics.stompCustomerChat.increment();
        log.debug("STOMP customer chat -> user {}", userId);
    }

    public void broadcastUserUpdate(Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/admin/users", payload);
        realtimeMetrics.stompAdminMessages.increment();
    }

    public void broadcastShipmentUpdate(String orderId, Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/orders/" + orderId + "/shipment", payload);
        messagingTemplate.convertAndSend("/topic/admin/fulfillment", payload);
        realtimeMetrics.stompAdminMessages.increment();
    }

    /** Push ticket event to admin topic AND to customer's queue. */
    public void pushTicketUpdate(String customerId, String ticketId, String event, Map<String, Object> extra) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("_event", event);
        m.put("ticketId", ticketId);
        if (extra != null) m.putAll(extra);
        messagingTemplate.convertAndSend("/topic/admin/tickets", m);
        if (customerId != null && !customerId.isBlank()) {
            messagingTemplate.convertAndSendToUser(customerId.trim(), "/queue/tickets", m);
        }
        realtimeMetrics.stompAdminMessages.increment();
        log.debug("STOMP ticket {} -> {} ({})", event, ticketId, customerId);
    }

    /**
     * Storefront catalog sync: authenticated customers subscribe to {@code /topic/catalog/changes}.
     * Payload is a hint only; clients should refetch product APIs (avoids stale partial merges).
     */
    public void broadcastCatalogProductChange(String productId, String change) {
        if (productId == null || productId.isBlank()) {
            return;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("_event", "catalog_product");
        m.put("productId", productId.trim());
        m.put("change", change != null && !change.isBlank() ? change.trim() : "updated");
        messagingTemplate.convertAndSend("/topic/catalog/changes", m);
        log.debug("STOMP catalog change -> {} ({})", productId, change);
    }
}
