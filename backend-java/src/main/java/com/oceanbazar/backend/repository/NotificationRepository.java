package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.NotificationEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificationRepository extends JpaRepository<NotificationEntity, String> {
    List<NotificationEntity> findByAudienceOrderByCreatedAtDesc(String audience);
    List<NotificationEntity> findByAudienceOrderByCreatedAtDesc(String audience, Pageable pageable);
    List<NotificationEntity> findByAudienceAndReadStatus(String audience, boolean readStatus);
    List<NotificationEntity> findByUserIdOrderByCreatedAtDesc(String userId);

    @Query("SELECT COUNT(n) FROM NotificationEntity n WHERE n.audience = :audience AND (n.readStatus = false OR n.readStatus IS NULL)")
    long countUnreadForAudience(@Param("audience") String audience);

    @Query("SELECT COUNT(n) FROM NotificationEntity n WHERE n.userId = :userId AND (n.readStatus = false OR n.readStatus IS NULL)")
    long countUnreadByUserId(@Param("userId") String userId);
}
