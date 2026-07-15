package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.NotificationEntity;
import com.oceanbazar.backend.realtime.RealtimeRedisPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Realtime fan-out via Redis → Node BFF Socket.IO (STOMP removed).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketBroadcastService {

    @Autowired(required = false)
    private RealtimeRedisPublisher realtimeRedis;

    public void broadcastOrderUpdate(String orderId, Map<String, Object> payload) {
        Map<String, Object> m = copy(payload);
        m.put("orderId", orderId);
        publishRoom("admin:orders", "admin:order:updated", m);
        log.debug("Broadcast order update: {}", orderId);
    }

    public void broadcastInventoryAlert(String productId, Map<String, Object> payload) {
        Map<String, Object> m = copy(payload);
        m.put("productId", productId);
        publishRoom("admin:inventory", "admin:inventory:alert", m);
    }

    public void broadcastNewReview(String productId, Map<String, Object> payload) {
        Map<String, Object> m = copy(payload);
        m.put("productId", productId);
        publishRoom("admin:reviews", "admin:review:new", m);
    }

    public void broadcastNotification(String userId, Map<String, Object> payload) {
        if (userId == null || userId.isBlank()) return;
        publishUser(userId.trim(), "notification:new", payload);
    }

    public void pushCustomerOrderStream(String userId, Map<String, Object> payload) {
        if (userId == null || userId.isBlank() || payload == null) return;
        Map<String, Object> m = copy(payload);
        m.put("_event", "order_update");
        publishUser(userId.trim(), "notification:new", m);
    }

    public void pushCustomerReturnStream(String userId, Map<String, Object> payload) {
        if (userId == null || userId.isBlank() || payload == null) return;
        Map<String, Object> m = copy(payload);
        m.put("_event", "return_update");
        publishUser(userId.trim(), "notification:new", m);
    }

    public void pushCustomerInbox(NotificationEntity n) {
        if (n == null || n.getUserId() == null || n.getUserId().isBlank()) return;
        broadcastNotification(n.getUserId().trim(), toCustomerNotificationPayload(n));
    }

    public void pushInboxRefreshHint(String userId) {
        if (userId == null || userId.isBlank()) return;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("_event", "inbox_refresh");
        publishUser(userId.trim(), "notification:new", m);
    }

    public void broadcastAdminAlert(Map<String, Object> payload) {
        publishRoom("admin:alerts", "admin:alert", payload);
    }

    public void broadcastPaymentUpdate(String orderId, Map<String, Object> payload) {
        Map<String, Object> m = copy(payload);
        m.put("orderId", orderId);
        publishRoom("admin:payments", "admin:payment", m);
    }

    public void broadcastChatUpdate(Map<String, Object> payload) {
        publishRoom("admin:chats", "admin:chat:new", payload);
    }

    public void broadcastReturnUpdate(Map<String, Object> payload) {
        publishRoom("admin:returns", "admin:return:new", payload);
    }

    public void pushCustomerChat(String userId, Map<String, Object> sessionPayload) {
        if (userId == null || userId.isBlank() || sessionPayload == null) return;
        publishUser(userId.trim(), "chat:message", sessionPayload);
    }

    public void broadcastUserUpdate(Map<String, Object> payload) {
        publishRoom("admin:users", "admin:user:new", payload);
    }

    public void broadcastShipmentUpdate(String orderId, Map<String, Object> payload) {
        Map<String, Object> m = copy(payload);
        m.put("orderId", orderId);
        publishRoom("admin:fulfillment", "admin:shipment:updated", m);
    }

    public void pushTicketUpdate(String customerId, String ticketId, String event, Map<String, Object> extra) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("_event", event);
        m.put("ticketId", ticketId);
        if (extra != null) m.putAll(extra);
        publishRoom("admin:tickets", "admin:ticket:updated", m);
        if (customerId != null && !customerId.isBlank()) {
            publishUser(customerId.trim(), "ticket:updated", m);
        }
    }

    public void broadcastCatalogProductChange(String productId, String change) {
        if (productId == null || productId.isBlank()) return;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("_event", "catalog_product");
        m.put("productId", productId.trim());
        m.put("change", change != null && !change.isBlank() ? change.trim() : "updated");
        publishRoom("catalog:changes", "catalog:updated", m);
    }

    private void publishRoom(String room, String event, Map<String, Object> payload) {
        if (realtimeRedis != null) {
            realtimeRedis.publishToRoom(room, event, payload);
        }
    }

    private void publishUser(String userId, String event, Map<String, Object> payload) {
        if (realtimeRedis != null) {
            realtimeRedis.publishToUser(userId, event, payload);
        }
    }

    private static Map<String, Object> copy(Map<String, Object> payload) {
        return payload != null ? new LinkedHashMap<>(payload) : new LinkedHashMap<>();
    }

    private static Map<String, Object> toCustomerNotificationPayload(NotificationEntity n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", n.getId() != null ? n.getId() : "");
        m.put("userId", n.getUserId() != null ? n.getUserId() : "");
        m.put("title", n.getTitle() != null ? n.getTitle() : "");
        m.put("message", n.getMessage() != null ? n.getMessage() : "");
        if (n.getImage() != null && !n.getImage().isBlank()) m.put("image", n.getImage());
        boolean read = Boolean.TRUE.equals(n.getReadStatus());
        m.put("readStatus", read);
        m.put("read", read);
        m.put("createdAt", n.getCreatedAt() != null ? n.getCreatedAt().toEpochMilli() : System.currentTimeMillis());
        m.put("kind", n.getKind() != null ? n.getKind() : "system");
        m.put("entityId", n.getEntityId() != null ? n.getEntityId() : "");
        return m;
    }
}
