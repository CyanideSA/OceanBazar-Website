package com.oceanbazar.backend.config;

import com.oceanbazar.backend.security.StompAuthChannelInterceptor;
import com.oceanbazar.backend.security.StompRateLimitChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * SockJS + STOMP:
 * <ul>
 *   <li>Endpoint {@code /ws} (SockJS + native WebSocket)</li>
 *   <li>Broker prefixes: {@code /topic}, {@code /queue}</li>
 *   <li>App prefix: {@code /app}; user queues: {@code /user/...}</li>
 * </ul>
 * JWT is validated on the STOMP CONNECT frame in {@link com.oceanbazar.backend.security.StompAuthChannelInterceptor}.
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompRateLimitChannelInterceptor stompRateLimitChannelInterceptor;
    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;

    /**
     * When true (default), handshake allows any Origin — fixes 403 on {@code /ws/info} in dev/LAN.
     * Set {@code oceanbazar.websocket.allow-all-origins=false} in production and list patterns instead.
     */
    @Value("${oceanbazar.websocket.allow-all-origins:true}")
    private boolean allowAllOrigins;

    @Value("${oceanbazar.websocket.allowed-origin-patterns:http://localhost:*,http://127.0.0.1:*,http://[::1]:*}")
    private String allowedOriginPatterns;

    @Value("${oceanbazar.websocket.allowed-origins:}")
    private String allowedOriginsLegacy;

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompRateLimitChannelInterceptor, stompAuthChannelInterceptor);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] patterns = resolveAllowedOriginPatterns();
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(patterns)
                .withSockJS();
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(patterns);
    }

    private String[] resolveAllowedOriginPatterns() {
        if (allowAllOrigins) {
            return new String[] { "*" };
        }
        Set<String> set = new LinkedHashSet<>();
        Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .forEach(set::add);
        Arrays.stream(allowedOriginsLegacy.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .forEach(set::add);
        if (set.isEmpty()) {
            return new String[] { "http://localhost:*", "http://127.0.0.1:*" };
        }
        return set.toArray(new String[0]);
    }
}
