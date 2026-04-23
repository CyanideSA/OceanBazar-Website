package com.oceanbazar.backend.security;

import com.oceanbazar.backend.entity.enums.AdminRole;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.UserRepository;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Authenticates STOMP {@code CONNECT} with the same JWT as REST (customer {@code user_id} or admin {@code admin_id}).
 * Restricts {@code SUBSCRIBE}: customers to {@code /user/.../queue/notifications}, {@code /user/.../queue/chat},
 * and read-only {@code /topic/catalog/changes}; admins to {@code /topic/**}.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 80)
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final AdminUserRepository adminUserRepository;

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String raw = accessor.getFirstNativeHeader("Authorization");
            if (raw == null || !raw.startsWith("Bearer ")) {
                String alt = accessor.getFirstNativeHeader("access-token");
                if (alt != null && !alt.isBlank()) {
                    raw = "Bearer " + alt.trim();
                }
            }
            if (raw == null || !raw.startsWith("Bearer ")) {
                throw new MessagingException("Missing bearer token");
            }
            String token = raw.substring(7).trim();
            try {
                Claims claims = jwtService.parse(token);
                Integer adminKey = AdminJwtSupport.parseAdminId(claims);
                if (adminKey != null) {
                    var admin = adminUserRepository.findById(adminKey).orElse(null);
                    if (admin == null || !Boolean.TRUE.equals(admin.getActive())) {
                        throw new MessagingException("Invalid admin session");
                    }
                    String wire = AdminRole.fromAny(admin.getRole()).wireRole();
                    var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + wire));
                    accessor.setUser(new UsernamePasswordAuthenticationToken(String.valueOf(adminKey), null, authorities));
                } else {
                    String userId = claims.get("user_id", String.class);
                    if (userId == null || userId.isBlank()) {
                        throw new MessagingException("Invalid token");
                    }
                    UserEntity user = userRepository.findById(userId).orElse(null);
                    if (user == null || !user.canAccessCustomerApi()) {
                        throw new MessagingException("Account inactive");
                    }
                    var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
                    accessor.setUser(new UsernamePasswordAuthenticationToken(userId, null, authorities));
                }
            } catch (MessagingException e) {
                throw e;
            } catch (Exception e) {
                throw new MessagingException("Invalid token", e);
            }
            return message;
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            Authentication auth = (Authentication) accessor.getUser();
            if (auth == null || !auth.isAuthenticated()) {
                throw new MessagingException("Unauthenticated");
            }
            String dest = accessor.getDestination();
            boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> {
                String r = a.getAuthority();
                return "ROLE_SUPER_ADMIN".equals(r) || "ROLE_ADMIN".equals(r) || "ROLE_STAFF".equals(r);
            });
            if (isAdmin) {
                if (dest == null || !dest.startsWith("/topic/")) {
                    throw new MessagingException("Admins may only subscribe to /topic/**");
                }
                // allow /topic/admin/orders, /topic/admin/chats, /topic/admin/returns, etc.
            } else {
                boolean allowedUserQueue = dest != null && dest.startsWith("/user/")
                        && (dest.contains("queue/notifications") || dest.contains("queue/chat"));
                boolean catalogTopic = dest != null && "/topic/catalog/changes".equals(dest);
                if (!allowedUserQueue && !catalogTopic) {
                    throw new MessagingException("Forbidden subscription");
                }
            }
        }

        return message;
    }
}
