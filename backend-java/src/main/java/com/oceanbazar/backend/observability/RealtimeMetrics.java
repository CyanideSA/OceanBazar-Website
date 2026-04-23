package com.oceanbazar.backend.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/**
 * Counters for SSE/STOMP/chat traffic. Exposed via Prometheus registry.
 */
@Component
public class RealtimeMetrics {
    public final Counter sseCustomerSubscriptions;
    public final Counter sseCustomerNotificationEvents;
    public final Counter sseCustomerOrderEvents;
    public final Counter sseCustomerReturnEvents;
    public final Counter sseCustomerChatEvents;
    public final Counter stompAdminMessages;
    public final Counter stompCustomerNotifications;
    public final Counter stompCustomerChat;

    public RealtimeMetrics(MeterRegistry registry) {
        sseCustomerSubscriptions = Counter.builder("oceanbazar.realtime.sse.customer.subscriptions")
                .description("Customer SSE subscription attempts (subscribe path)")
                .register(registry);
        sseCustomerNotificationEvents = Counter.builder("oceanbazar.realtime.sse.customer.notification.events")
                .register(registry);
        sseCustomerOrderEvents = Counter.builder("oceanbazar.realtime.sse.customer.order.events")
                .register(registry);
        sseCustomerReturnEvents = Counter.builder("oceanbazar.realtime.sse.customer.return.events")
                .register(registry);
        sseCustomerChatEvents = Counter.builder("oceanbazar.realtime.sse.customer.chat.events")
                .register(registry);
        stompAdminMessages = Counter.builder("oceanbazar.realtime.stomp.admin.messages")
                .description("Inbound STOMP frames handled on admin topics (approximation)")
                .register(registry);
        stompCustomerNotifications = Counter.builder("oceanbazar.realtime.stomp.customer.notifications")
                .description("Customer inbox pushes over STOMP user queue")
                .register(registry);
        stompCustomerChat = Counter.builder("oceanbazar.realtime.stomp.customer.chat")
                .description("Customer chat session pushes over STOMP user queue")
                .register(registry);
    }
}
