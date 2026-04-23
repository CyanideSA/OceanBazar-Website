package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.OtpCodeEntity;
import com.oceanbazar.backend.entity.enums.OtpType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

public interface OtpCodeRepository extends JpaRepository<OtpCodeEntity, Integer> {

    Optional<OtpCodeEntity> findFirstByTargetAndTypeAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
            String target, OtpType type, Instant now);

    @Transactional
    @Modifying
    @Query("UPDATE OtpCodeEntity o SET o.used = true WHERE o.target = :target AND o.type = :type AND o.used = false")
    int markAllUsed(@Param("target") String target, @Param("type") OtpType type);
}
