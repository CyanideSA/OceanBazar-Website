package com.oceanbazar.backend.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Soft limits on STOMP frames to reduce reconnect storms and abusive traffic.
 * Runs before {@link StompAuthChannelInterceptor} so failed CONNECT attempts are still bounded.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 65)
public class StompRateLimitChannelInterceptor implements ChannelInterceptor {

    private final int maxConnectPerMinutePerToken;
    private final int maxSubscribePerMinutePerSession;
    private final int maxSendPerMinutePerSession;

    /** Keys are {@code type:logicalKey:minuteBucket}; short-lived. */
    private final ConcurrentHashMap<String, AtomicInteger> minuteBuckets = new ConcurrentHashMap<>();

    public StompRateLimitChannelInterceptor(
            @Value("${oceanbazar.websocket.stomp.max-connect-per-minute-per-token:25}") int maxConnectPerMinutePerToken,
            @Value("${oceanbazar.websocket.stomp.max-subscribe-per-minute-per-session:60}") int maxSubscribePerMinutePerSession,
            @Value("${oceanbazar.websocket.stomp.max-send-per-minute-per-session:180}") int maxSendPerMinutePerSession
    ) {
        this.maxConnectPerMinutePerToken = Math.max(1, maxConnectPerMinutePerToken);
        this.maxSubscribePerMinutePerSession = Math.max(1, maxSubscribePerMinutePerSession);
        this.maxSendPerMinutePerSession = Math.max(1, maxSendPerMinutePerSession);
    }

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }
        StompCommand cmd = accessor.getCommand();
        if (cmd == null) {
            return message;
        }

        long minute = System.currentTimeMillis() / 60_000L;

        if (StompCommand.CONNECT.equals(cmd)) {
            String auth = accessor.getFirstNativeHeader("Authorization");
            if (auth == null || auth.isBlank()) {
                String alt = accessor.getFirstNativeHeader("access-token");
                if (alt != null && !alt.isBlank()) {
                    auth = "Bearer " + alt.trim();
                }
            }
            String fp = auth == null ? "none" : Integer.toHexString(auth.hashCode());
            if (!allow("c", fp, minute, maxConnectPerMinutePerToken)) {
                throw new MessagingException("Too many connection attempts; try again shortly");
            }
            return message;
        }

        String sessionId = accessor.getSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            return message;
        }

        if (StompCommand.SUBSCRIBE.equals(cmd)) {
            if (!allow("s", sessionId, minute, maxSubscribePerMinutePerSession)) {
                throw new MessagingException("Subscribe rate limit exceeded");
            }
        } else if (StompCommand.SEND.equals(cmd)) {
            String dest = accessor.getDestination();
            if (dest != null && dest.startsWith("/app/")) {
                if (!allow("m", sessionId, minute, maxSendPerMinutePerSession)) {
                    throw new MessagingException("Message send rate limit exceeded");
                }
            }
        }

        return message;
    }

    private boolean allow(String kind, String logicalKey, long minute, int max) {
        String key = kind + ":" + logicalKey + ":" + minute;
        int n = minuteBuckets.computeIfAbsent(key, k -> new AtomicInteger(0)).incrementAndGet();
        if (minuteBuckets.size() > 8000) {
            minuteBuckets.keySet().removeIf(k -> {
                int lastColon = k.lastIndexOf(':');
                if (lastColon < 0) {
                    return true;
                }
                try {
                    long mk = Long.parseLong(k.substring(lastColon + 1));
                    return mk < minute - 2;
                } catch (NumberFormatException ex) {
                    return true;
                }
            });
        }
        return n <= max;
    }
}
