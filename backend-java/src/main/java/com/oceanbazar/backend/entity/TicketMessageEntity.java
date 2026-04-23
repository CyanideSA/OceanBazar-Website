package com.oceanbazar.backend.entity;

import com.oceanbazar.backend.entity.enums.SenderType;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "ticket_messages")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class TicketMessageEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "ticket_id", columnDefinition = "char(8)", nullable = false)
    private String ticketId;

    @Enumerated(EnumType.STRING)
    @Column(name = "sender_type", nullable = false)
    private SenderType senderType;

    @Column(name = "sender_id", length = 50, nullable = false)
    private String senderId;

    @Column(columnDefinition = "text", nullable = false)
    private String message;

    @Column(columnDefinition = "text[]")
    private String[] attachments;

    @Column(name = "created_at", columnDefinition = "timestamptz", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}
