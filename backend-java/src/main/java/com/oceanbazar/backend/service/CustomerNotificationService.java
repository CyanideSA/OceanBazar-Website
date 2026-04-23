package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.CustomerNotificationDto;
import com.oceanbazar.backend.entity.NotificationEntity;
import com.oceanbazar.backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomerNotificationService {

    private final NotificationRepository notificationRepository;
    private final WebSocketBroadcastService webSocketBroadcastService;

    public List<CustomerNotificationDto> getNotifications(String userId) {
        return listForUser(userId);
    }

    public long getUnreadCount(String userId) {
        return countUnreadForUser(userId);
    }

    public CustomerNotificationDto markAsRead(String notificationId, String userId) {
        return markReadForUser(notificationId, userId);
    }

    @Transactional(readOnly = true)
    public List<CustomerNotificationDto> listForUser(String userId) {
        if (userId == null || userId.isBlank()) {
            return List.of();
        }
        String uid = userId.trim();
        try {
            List<NotificationEntity> entities = notificationRepository.findByUserIdOrderByCreatedAtDesc(uid);
            return entities.stream()
                    .map(this::toDto)
                    .filter(dto -> dto != null && dto.getId() != null && !dto.getId().isBlank())
                    .limit(500)
                    .toList();
        } catch (Exception e) {
            log.error("Failed to list notifications for user {}", uid, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not load notifications");
        }
    }

    @Transactional(readOnly = true)
    public long countUnreadForUser(String userId) {
        if (userId == null || userId.isBlank()) {
            return 0L;
        }
        String uid = userId.trim();
        try {
            return notificationRepository.countUnreadByUserId(uid);
        } catch (Exception e) {
            log.error("Failed to count unread notifications for user {}", uid, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not count notifications");
        }
    }

    @Transactional
    public CustomerNotificationDto markReadForUser(String notificationId, String userId) {
        if (notificationId == null || notificationId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notification id required");
        }
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        String uid = userId.trim();
        String nid = notificationId.trim();

        NotificationEntity entity = notificationRepository.findById(nid).orElse(null);
        if (entity == null || !uid.equals(entity.getUserId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found");
        }

        entity.setReadStatus(true);
        notificationRepository.save(entity);

        CustomerNotificationDto dto = toDto(entity);
        webSocketBroadcastService.pushInboxRefreshHint(uid);
        return dto;
    }

    public NotificationEntity notifyCustomer(String userId, String title, String message, String kind, String entityId) {
        return notifyCustomer(userId, title, message, kind, entityId, null, null);
    }

    public NotificationEntity notifyCustomer(String userId, String title, String message, String kind, String entityId, String image) {
        return notifyCustomer(userId, title, message, kind, entityId, image, null);
    }

    @Transactional
    public NotificationEntity notifyCustomer(String userId, String title, String message,
                                              String kind, String entityId, String image,
                                              String createdByAdminId) {
        if (userId == null || userId.isBlank()) {
            return null;
        }
        NotificationEntity n = new NotificationEntity();
        n.setAudience("user");
        n.setUserId(userId.trim());
        n.setTitle(title != null ? title : "Update");
        n.setMessage(message != null ? message : "");
        n.setKind(kind != null ? kind : "system");
        n.setEntityId(entityId);
        if (image != null && !image.isBlank()) {
            n.setImage(image.trim());
        }
        if (createdByAdminId != null && !createdByAdminId.isBlank()) {
            n.setCreatedByAdminId(createdByAdminId.trim());
        }
        n.setReadStatus(false);
        n.setCreatedAt(Instant.now());
        NotificationEntity saved = notificationRepository.save(n);
        webSocketBroadcastService.pushCustomerInbox(saved);
        return saved;
    }

    private CustomerNotificationDto toDto(NotificationEntity e) {
        if (e == null) return null;
        return CustomerNotificationDto.builder()
                .id(e.getId())
                .title(e.getTitle() != null ? e.getTitle() : "Notification")
                .message(e.getMessage() != null ? e.getMessage() : "")
                .image(e.getImage() != null && !e.getImage().isBlank() ? e.getImage() : null)
                .kind(e.getKind() != null ? e.getKind() : "system")
                .entityId(e.getEntityId())
                .read(Boolean.TRUE.equals(e.getReadStatus()))
                .createdAt(e.getCreatedAt() != null ? Date.from(e.getCreatedAt()) : new Date(0L))
                .build();
    }
}
