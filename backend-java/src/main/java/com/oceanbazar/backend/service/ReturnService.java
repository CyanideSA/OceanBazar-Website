package com.oceanbazar.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oceanbazar.backend.entity.ReturnRequestEntity;
import com.oceanbazar.backend.events.DomainEventPublisher;
import com.oceanbazar.backend.events.ReturnStatusChangedEvent;
import com.oceanbazar.backend.repository.ReturnRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ReturnService {
    private final ReturnRequestRepository returnRequestRepository;
    private final CustomerReturnOrchestrationService customerReturnOrchestrationService;
    private final DomainEventPublisher domainEventPublisher;
    private final CustomerNotificationService customerNotificationService;
    private final ObjectMapper objectMapper;

    public List<ReturnRequestEntity> listAll() {
        return returnRequestRepository.findAll();
    }

    public List<ReturnRequestEntity> listByStatus(String status) {
        return returnRequestRepository.findByStatus(status);
    }

    public List<ReturnRequestEntity> listByUser(String userId) {
        return returnRequestRepository.findByUserId(userId);
    }

    public ReturnRequestEntity getById(String id) {
        return returnRequestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Return request not found"));
    }

    /**
     * Customer-facing fetch: only the owning user may load the return.
     */
    public ReturnRequestEntity getByIdForUser(String id, String authenticatedUserId) {
        ReturnRequestEntity r = getById(id);
        if (authenticatedUserId == null || !authenticatedUserId.equals(r.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your return request");
        }
        return r;
    }

    public ReturnRequestEntity create(ReturnRequestEntity request, String authenticatedUserId) {
        if (authenticatedUserId == null || authenticatedUserId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (request.getOrderId() == null || request.getOrderId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "orderId is required");
        }
        ReturnRequestEntity saved = customerReturnOrchestrationService.submitCustomerReturn(
                authenticatedUserId,
                request.getOrderId().trim(),
                null,
                request
        );
        notifyReturnCustomer(
                saved,
                "Return request received",
                "We're reviewing your return. You can track status from your account.");
        return saved;
    }

    public ReturnRequestEntity updateStatus(String id, String status, String note, String actorId, String actorType) {
        ReturnRequestEntity request = getById(id);
        request.setStatus(status);
        request.setUpdatedAt(Instant.now());
        if (note != null) request.setAdminNote(note);
        if (actorType.equals("admin")) request.setAssignedToAdminId(actorId);
        addTimeline(request, status, note, actorId, actorType);
        ReturnRequestEntity saved = returnRequestRepository.save(request);
        if (saved.getUserId() != null && saved.getOrderId() != null) {
            domainEventPublisher.publish(new ReturnStatusChangedEvent(
                    saved.getUserId(), saved.getOrderId(), saved.getId(), status));
        }
        notifyReturnCustomer(
                saved,
                "Return status updated",
                "Your return request is now " + (status == null ? "updated" : status) + ".");
        return saved;
    }

    public ReturnRequestEntity processRefund(String id, Double amount, String method) {
        ReturnRequestEntity request = getById(id);
        request.setRefundAmount(amount);
        request.setRefundMethod(method);
        request.setStatus("refunded");
        request.setUpdatedAt(Instant.now());
        addTimeline(request, "refunded", "Refund of " + amount + " processed via " + method, null, "system");
        ReturnRequestEntity saved = returnRequestRepository.save(request);
        if (saved.getUserId() != null && saved.getOrderId() != null) {
            domainEventPublisher.publish(new ReturnStatusChangedEvent(
                    saved.getUserId(), saved.getOrderId(), saved.getId(), "refunded"));
        }
        notifyReturnCustomer(
                saved,
                "Refund processed",
                "Your refund of " + amount + " has been processed (" + method + ").");
        return saved;
    }

    private void notifyReturnCustomer(ReturnRequestEntity rr, String title, String message) {
        if (rr.getUserId() == null || rr.getUserId().isBlank() || rr.getOrderId() == null || rr.getOrderId().isBlank()) {
            return;
        }
        customerNotificationService.notifyCustomer(
                rr.getUserId().trim(),
                title,
                message,
                "return",
                rr.getOrderId().trim());
    }

    private void addTimeline(ReturnRequestEntity request, String status, String note, String actorId, String actorType) {
        List<Map<String, Object>> timeline;
        try {
            timeline = request.getTimeline() != null
                    ? objectMapper.readValue(request.getTimeline(), new TypeReference<>() {})
                    : new ArrayList<>();
        } catch (Exception e) {
            timeline = new ArrayList<>();
        }
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("id", UUID.randomUUID().toString());
        entry.put("at", Instant.now().toString());
        entry.put("status", status);
        entry.put("note", note);
        entry.put("actorId", actorId);
        entry.put("actorType", actorType);
        timeline.add(entry);
        try {
            request.setTimeline(objectMapper.writeValueAsString(timeline));
        } catch (Exception ignored) {
        }
    }
}
