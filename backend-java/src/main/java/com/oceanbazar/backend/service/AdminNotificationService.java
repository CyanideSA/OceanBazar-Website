package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.AdminNotificationDtos;
import com.oceanbazar.backend.entity.NotificationEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.entity.enums.AccountStatus;
import com.oceanbazar.backend.repository.NotificationRepository;
import com.oceanbazar.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminNotificationService {
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final CustomerNotificationService customerNotificationService;
    private final SimpMessagingTemplate messagingTemplate;
    private final RedisTemplate<String, Long> redisTemplate;

    private static final String UNREAD_KEY_PREFIX = "admin:unread:";

    public long countUnreadAdmins() {
        return notificationRepository.countUnreadForAudience("admins");
    }

    public NotificationEntity markAdminInboxRead(String notificationId) {
        NotificationEntity n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        if (!"admins".equalsIgnoreCase(n.getAudience() == null ? "" : n.getAudience())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not an admin inbox notification");
        }
        n.setReadStatus(true);
        notificationRepository.save(n);
        redisTemplate.delete(UNREAD_KEY_PREFIX + n.getCreatedByAdminId());
        return n;
    }

    public long markAllAdminInboxRead() {
        List<NotificationEntity> unread = notificationRepository.findByAudienceAndReadStatus("admins", false);
        long count = 0;
        for (NotificationEntity n : unread) {
            n.setReadStatus(true);
            notificationRepository.save(n);
            count++;
        }
        redisTemplate.delete(redisTemplate.keys(UNREAD_KEY_PREFIX + "*"));
        return count;
    }

    public List<NotificationEntity> listNotifications(String audience, Boolean adminInbox) {
        if (Boolean.TRUE.equals(adminInbox)) {
            return notificationRepository.findByAudienceOrderByCreatedAtDesc("admins", PageRequest.of(0, 200));
        }

        if (audience != null && !audience.isBlank()) {
            return notificationRepository.findByAudienceOrderByCreatedAtDesc(audience);
        }

        return notificationRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    public NotificationEntity createNotification(String actorAdminId, AdminNotificationDtos.CreateNotificationRequest req) {
        if (actorAdminId == null || actorAdminId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin actor");
        }
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body required");
        }

        NotificationEntity n = new NotificationEntity();
        n.setTitle(req.getTitle());
        n.setMessage(req.getMessage());
        n.setAudience(req.getAudience() == null || req.getAudience().isBlank()
                ? "all"
                : req.getAudience().trim().toLowerCase());
        n.setUserId(req.getUserId());
        n.setCreatedByAdminId(actorAdminId);
        notificationRepository.save(n);
        messagingTemplate.convertAndSend("/topic/admin/notifications", n);
        redisTemplate.delete(redisTemplate.keys(UNREAD_KEY_PREFIX + "*"));
        return n;
    }

    public long getUnreadCountForAdmin(String adminId) {
        String key = UNREAD_KEY_PREFIX + adminId;
        Long cachedCount = redisTemplate.opsForValue().get(key);
        if (cachedCount != null) {
            return cachedCount;
        }
        long count = notificationRepository.countUnreadForAudience("admins");
        redisTemplate.opsForValue().set(key, count, 60, TimeUnit.SECONDS);
        return count;
    }

    /**
     * One persisted {@link NotificationEntity} per active customer; each fan-out uses STOMP + SSE like other customer alerts.
     */
    public Map<String, Object> broadcastToAllActiveCustomers(String adminId, AdminNotificationDtos.BroadcastToCustomersRequest req) {
        if (adminId == null || adminId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin actor");
        }
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body required");
        }
        String title = req.getTitle().trim();
        String message = req.getMessage().trim();
        String image = req.getImage();
        if (image != null) {
            image = image.trim();
            if (image.isEmpty()) {
                image = null;
            }
        }
        int recipientCount = 0;
        int failureCount = 0;
        for (UserEntity u : userRepository.findAll()) {
            if (u.getId() == null || u.getId().isBlank() || u.getAccountStatus() != AccountStatus.active) {
                continue;
            }
            try {
                customerNotificationService.notifyCustomer(u.getId(), title, message, "broadcast", null, image, adminId);
                recipientCount++;
            } catch (Exception ex) {
                failureCount++;
                log.warn("Customer broadcast failed for user {}: {}", u.getId(), ex.getMessage());
            }
        }
        return Map.of(
                "recipientCount", recipientCount,
                "failureCount", failureCount,
                "title", title
        );
    }
}
