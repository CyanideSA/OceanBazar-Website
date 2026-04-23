package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.CustomerNotificationDto;
import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.service.CustomerNotificationHub;
import com.oceanbazar.backend.service.CustomerNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class CustomerNotificationController {

    private final AuthTokenService authTokenService;
    private final CustomerNotificationService customerNotificationService;
    private final CustomerNotificationHub customerNotificationHub;

    @GetMapping("")
    public List<CustomerNotificationDto> list(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = requireCustomerUserId(authorization);
        return customerNotificationService.getNotifications(userId);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = requireCustomerUserId(authorization);
        long count = customerNotificationService.getUnreadCount(userId);
        return Map.of("count", count);
    }

    /**
     * Optional SSE stream (legacy). Prefer STOMP over {@code /ws} with {@code /user/queue/notifications}.
     * Query param {@code access_token} is for clients that cannot send {@code Authorization} (e.g. {@code EventSource}).
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(value = "access_token", required = false) String accessToken) {
        String userId;
        if (authorization != null && authorization.startsWith("Bearer ")) {
            userId = authTokenService.getUserIdFromAuthorization(authorization);
        } else if (accessToken != null && !accessToken.isBlank()) {
            userId = authTokenService.getUserIdFromJwtToken(accessToken);
        } else {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return customerNotificationHub.subscribe(userId);
    }

    @PatchMapping("/{id}/read")
    public CustomerNotificationDto markRead(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String id) {
        String userId = requireCustomerUserId(authorization);
        return customerNotificationService.markAsRead(id, userId);
    }

    private String requireCustomerUserId(String authorization) {
        try {
            return authTokenService.getUserIdFromAuthorization(authorization);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication credentials");
        }
    }
}
