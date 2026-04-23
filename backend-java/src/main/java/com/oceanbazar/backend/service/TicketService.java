package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.TicketEntity;
import com.oceanbazar.backend.entity.TicketMessageEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.entity.enums.SenderType;
import com.oceanbazar.backend.entity.enums.TicketCategory;
import com.oceanbazar.backend.entity.enums.TicketPriority;
import com.oceanbazar.backend.entity.enums.TicketStatus;
import com.oceanbazar.backend.repository.TicketMessageRepository;
import com.oceanbazar.backend.repository.TicketRepository;
import com.oceanbazar.backend.repository.UserRepository;
import com.oceanbazar.backend.utils.ShortId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketMessageRepository ticketMessageRepository;
    private final UserRepository userRepository;
    private final WebSocketBroadcastService broadcastService;

    /* ── Customer: create ticket ── */
    @Transactional
    public Map<String, Object> createTicket(String userId, CreateTicketRequest req) {
        if (userId == null || userId.isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");

        TicketEntity ticket = new TicketEntity();
        ticket.setId(ShortId.newId8());
        ticket.setUserId(userId);
        ticket.setSubject(req.getSubject().trim());
        ticket.setCategory(safeCategory(req.getCategory()));
        ticket.setPriority(safePriority(req.getPriority()));
        ticket.setStatus(TicketStatus.open);
        ticket.setOrderId(blank(req.getOrderId()));
        ticket.setProductId(blank(req.getProductId()));
        ticket.setPaymentTxId(blank(req.getPaymentTxId()));
        Instant now = Instant.now();
        ticket.setCreatedAt(now);
        ticket.setUpdatedAt(now);
        ticket = ticketRepository.save(ticket);

        /* First message from customer */
        if (req.getMessage() != null && !req.getMessage().isBlank()) {
            TicketMessageEntity msg = new TicketMessageEntity();
            msg.setTicketId(ticket.getId());
            msg.setSenderType(SenderType.customer);
            msg.setSenderId(userId);
            msg.setMessage(req.getMessage().trim());
            msg.setAttachments(req.getAttachments());
            msg.setCreatedAt(now);
            ticketMessageRepository.save(msg);
        }

        /* STOMP: push to admin topic + customer queue */
        broadcastService.pushTicketUpdate(userId, ticket.getId(), "ticket_created",
                Map.of("subject", ticket.getSubject()));

        /* Email confirmation stub — wire your email service here */
        sendConfirmationEmail(userId, ticket);

        return buildDetailPayload(ticket, userId, false);
    }

    /* ── Customer: list own tickets ── */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listForUser(String userId) {
        return ticketRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(t -> buildSummaryPayload(t, false))
                .toList();
    }

    /* ── Customer: get ticket detail ── */
    @Transactional(readOnly = true)
    public Map<String, Object> getForUser(String ticketId, String userId) {
        TicketEntity ticket = getTicketOrThrow(ticketId);
        if (!userId.equals(ticket.getUserId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        return buildDetailPayload(ticket, userId, false);
    }

    /* ── Customer: reply ── */
    @Transactional
    public Map<String, Object> replyAsCustomer(String ticketId, String userId, String message, String[] attachments) {
        TicketEntity ticket = getTicketOrThrow(ticketId);
        if (!userId.equals(ticket.getUserId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        if (ticket.getStatus() == TicketStatus.closed)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket is closed");

        TicketMessageEntity msg = new TicketMessageEntity();
        msg.setTicketId(ticketId);
        msg.setSenderType(SenderType.customer);
        msg.setSenderId(userId);
        msg.setMessage(message.trim());
        msg.setAttachments(attachments);
        msg.setCreatedAt(Instant.now());
        ticketMessageRepository.save(msg);

        ticket.setStatus(TicketStatus.open);
        ticket.setUpdatedAt(Instant.now());
        ticketRepository.save(ticket);

        broadcastService.pushTicketUpdate(ticket.getUserId(), ticketId, "customer_reply", null);
        return buildDetailPayload(ticket, userId, false);
    }

    /* ── Admin: list all tickets ── */
    @Transactional(readOnly = true)
    public Map<String, Object> adminList(String status, String priority, String category,
                                         String userId, int page, int size) {
        List<TicketEntity> all = ticketRepository.findAll(
                Sort.by(Sort.Direction.DESC, "updatedAt")
        );
        List<Map<String, Object>> filtered = all.stream()
                .filter(t -> status == null || status.isBlank() || t.getStatus().name().equalsIgnoreCase(status))
                .filter(t -> priority == null || priority.isBlank() || t.getPriority().name().equalsIgnoreCase(priority))
                .filter(t -> category == null || category.isBlank() || t.getCategory().name().equalsIgnoreCase(category))
                .filter(t -> userId == null || userId.isBlank() || userId.equals(t.getUserId()))
                .map(t -> buildSummaryPayload(t, true))
                .toList();
        int total = filtered.size();
        int from  = Math.min((page - 1) * size, total);
        int to    = Math.min(from + size, total);
        return Map.of(
                "tickets", filtered.subList(from, to),
                "total", total,
                "page", page,
                "totalPages", (int) Math.ceil((double) total / size)
        );
    }

    /* ── Admin: get ticket detail ── */
    @Transactional(readOnly = true)
    public Map<String, Object> adminGet(String ticketId) {
        return buildDetailPayload(getTicketOrThrow(ticketId), null, true);
    }

    /* ── Admin: update ticket (status / priority / assignedTo) ── */
    @Transactional
    public Map<String, Object> adminUpdate(String ticketId, AdminUpdateRequest req) {
        TicketEntity ticket = getTicketOrThrow(ticketId);
        if (req.getStatus() != null)   ticket.setStatus(safeStatus(req.getStatus()));
        if (req.getPriority() != null) ticket.setPriority(safePriority(req.getPriority()));
        if (req.getAssignedTo() != null) ticket.setAssignedTo(req.getAssignedTo());
        ticket.setUpdatedAt(Instant.now());
        ticket = ticketRepository.save(ticket);
        broadcastService.pushTicketUpdate(ticket.getUserId(), ticket.getId(), "ticket_updated", null);
        return buildDetailPayload(ticket, null, true);
    }

    /* ── Admin: reply ── */
    @Transactional
    public Map<String, Object> adminReply(String ticketId, String adminId, String message, String[] attachments) {
        TicketEntity ticket = getTicketOrThrow(ticketId);

        TicketMessageEntity msg = new TicketMessageEntity();
        msg.setTicketId(ticketId);
        msg.setSenderType(SenderType.admin);
        msg.setSenderId(adminId);
        msg.setMessage(message.trim());
        msg.setAttachments(attachments);
        msg.setCreatedAt(Instant.now());
        ticketMessageRepository.save(msg);

        if (ticket.getStatus() == TicketStatus.open) {
            ticket.setStatus(TicketStatus.in_progress);
        }
        ticket.setUpdatedAt(Instant.now());
        ticketRepository.save(ticket);

        broadcastService.pushTicketUpdate(ticket.getUserId(), ticketId, "admin_reply", null);
        broadcastService.broadcastNotification(ticket.getUserId(), Map.of(
                "_event", "ticket_reply",
                "ticketId", ticketId,
                "message", "An admin replied to your support ticket."
        ));

        return buildDetailPayload(ticket, null, true);
    }

    /* ── Admin: create ticket on behalf of customer ── */
    @Transactional
    public Map<String, Object> adminCreate(String adminId, CreateTicketRequest req) {
        if (req.getUserId() == null || req.getUserId().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");

        TicketEntity ticket = new TicketEntity();
        ticket.setId(ShortId.newId8());
        ticket.setUserId(req.getUserId());
        ticket.setSubject(req.getSubject().trim());
        ticket.setCategory(safeCategory(req.getCategory()));
        ticket.setPriority(safePriority(req.getPriority()));
        ticket.setStatus(TicketStatus.open);
        ticket.setOrderId(blank(req.getOrderId()));
        ticket.setProductId(blank(req.getProductId()));
        ticket.setPaymentTxId(blank(req.getPaymentTxId()));
        Instant now = Instant.now();
        ticket.setCreatedAt(now);
        ticket.setUpdatedAt(now);
        ticket = ticketRepository.save(ticket);

        if (req.getMessage() != null && !req.getMessage().isBlank()) {
            TicketMessageEntity msg = new TicketMessageEntity();
            msg.setTicketId(ticket.getId());
            msg.setSenderType(SenderType.admin);
            msg.setSenderId(adminId);
            msg.setMessage(req.getMessage().trim());
            msg.setCreatedAt(now);
            ticketMessageRepository.save(msg);
        }

        broadcastService.pushTicketUpdate(ticket.getUserId(), ticket.getId(), "ticket_created", null);
        return buildDetailPayload(ticket, null, true);
    }

    /* ── Stats ── */
    @Transactional(readOnly = true)
    public Map<String, Object> stats() {
        return Map.of(
                "open",        ticketRepository.countByStatus(TicketStatus.open),
                "in_progress", ticketRepository.countByStatus(TicketStatus.in_progress),
                "resolved",    ticketRepository.countByStatus(TicketStatus.resolved),
                "closed",      ticketRepository.countByStatus(TicketStatus.closed)
        );
    }

    /* ── Helpers ── */
    private TicketEntity getTicketOrThrow(String id) {
        return ticketRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
    }

    private Map<String, Object> buildSummaryPayload(TicketEntity t, boolean admin) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",         t.getId());
        m.put("userId",     t.getUserId());
        m.put("subject",    t.getSubject());
        m.put("status",     t.getStatus().name());
        m.put("priority",   t.getPriority().name());
        m.put("category",   t.getCategory().name());
        m.put("orderId",    t.getOrderId());
        m.put("productId",  t.getProductId());
        m.put("paymentTxId",t.getPaymentTxId());
        m.put("assignedTo", t.getAssignedTo());
        m.put("createdAt",  t.getCreatedAt());
        m.put("updatedAt",  t.getUpdatedAt());
        if (admin) {
            UserEntity user = userRepository.findById(t.getUserId()).orElse(null);
            m.put("customerName",  user != null ? user.getName()  : null);
            m.put("customerEmail", user != null ? user.getEmail() : null);
        }
        return m;
    }

    private Map<String, Object> buildDetailPayload(TicketEntity t, String requesterId, boolean admin) {
        Map<String, Object> m = buildSummaryPayload(t, admin);
        List<TicketMessageEntity> msgs = ticketMessageRepository.findByTicketIdOrderByCreatedAtAsc(t.getId());
        List<Map<String, Object>> msgList = msgs.stream().map(msg -> {
            Map<String, Object> mm = new LinkedHashMap<>();
            mm.put("id",          msg.getId());
            mm.put("senderType",  msg.getSenderType().name());
            mm.put("senderId",    msg.getSenderId());
            mm.put("message",     msg.getMessage());
            mm.put("attachments", msg.getAttachments() != null ? Arrays.asList(msg.getAttachments()) : List.of());
            mm.put("createdAt",   msg.getCreatedAt());
            return mm;
        }).toList();
        m.put("messages", msgList);
        m.put("messageCount", msgList.size());
        return m;
    }

    private void sendConfirmationEmail(String userId, TicketEntity ticket) {
        try {
            UserEntity user = userRepository.findById(userId).orElse(null);
            if (user == null || user.getEmail() == null) return;
            log.info("[TICKET EMAIL] Confirmation for ticket {} → {}: subject={}",
                    ticket.getId(), user.getEmail(), ticket.getSubject());
            /* TODO: inject JavaMailSender and send templated email */
        } catch (Exception e) {
            log.warn("Could not send ticket confirmation email: {}", e.getMessage());
        }
    }

    private static String blank(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static TicketCategory safeCategory(String s) {
        try { return TicketCategory.valueOf(s.toLowerCase()); } catch (Exception e) { return TicketCategory.other; }
    }
    private static TicketPriority safePriority(String s) {
        try { return TicketPriority.valueOf(s.toLowerCase()); } catch (Exception e) { return TicketPriority.medium; }
    }
    private static TicketStatus safeStatus(String s) {
        try { return TicketStatus.valueOf(s.toLowerCase()); } catch (Exception e) { return TicketStatus.open; }
    }

    /* ── Request DTOs ── */
    @lombok.Data
    public static class CreateTicketRequest {
        private String userId;    /* admin-only: create on behalf */
        private String subject;
        private String category;
        private String priority;
        private String message;
        private String orderId;
        private String productId;
        private String paymentTxId;
        private String[] attachments;
    }

    @lombok.Data
    public static class AdminUpdateRequest {
        private String status;
        private String priority;
        private Integer assignedTo;
    }
}
