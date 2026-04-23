package com.oceanbazar.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oceanbazar.backend.entity.DisputeEntity;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.ReturnRequestEntity;
import com.oceanbazar.backend.events.DomainEventPublisher;
import com.oceanbazar.backend.events.ReturnSubmittedEvent;
import com.oceanbazar.backend.repository.DisputeRepository;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.ReturnRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

/**
 * Single write path for customer-initiated returns: updates {@link OrderEntity}, creates {@link DisputeEntity}
 * and {@link ReturnRequestEntity} together.
 */
@Service
@RequiredArgsConstructor
public class CustomerReturnOrchestrationService {
    private final OrderRepository orderRepository;
    private final DisputeRepository disputeRepository;
    private final ReturnRequestRepository returnRequestRepository;
    private final DomainEventPublisher domainEventPublisher;
    private final ObjectMapper objectMapper;

    public OrderEntity resolveOrderForCustomerKey(String orderIdOrNumber) {
        if (orderIdOrNumber == null || orderIdOrNumber.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order id required");
        }
        String raw = orderIdOrNumber.trim();
        return orderRepository.findById(raw)
                .or(() -> orderRepository.findByOrderNumber(raw.toUpperCase()))
                .or(() -> orderRepository.findByOrderNumber(raw))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
    }

    /**
     * @param reasonFromProfile optional reason string (profile / dispute form).
     * @param template          optional payload from {@code POST /api/returns} (items, description, etc.).
     */
    public ReturnRequestEntity submitCustomerReturn(String userId, String orderKey, String reasonFromProfile, ReturnRequestEntity template) {
        OrderEntity order = resolveOrderForCustomerKey(orderKey);
        if (!userId.equals(order.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your order");
        }

        String reason = reasonFromProfile;
        if ((reason == null || reason.isBlank()) && template != null) {
            reason = template.getReason();
        }
        if ((reason == null || reason.isBlank()) && template != null) {
            reason = template.getDescription();
        }

        orderRepository.save(order);

        DisputeEntity dispute = new DisputeEntity();
        dispute.setOrderId(order.getId());
        dispute.setUserId(order.getUserId());
        dispute.setTitle("Customer return / dispute request");
        dispute.setDescription(reason == null || reason.isBlank() ? "Customer requested return or review." : reason);
        dispute.setStatus("open");
        dispute.setPriority("medium");
        disputeRepository.save(dispute);

        ReturnRequestEntity rr = template != null ? copyTemplate(template) : new ReturnRequestEntity();
        rr.setId(null);
        rr.setOrderId(order.getId());
        rr.setUserId(userId);
        rr.setDisputeId(dispute.getId());
        if (rr.getReason() == null || rr.getReason().isBlank()) {
            rr.setReason(reason);
        }
        if (rr.getStatus() == null || rr.getStatus().isBlank()) {
            rr.setStatus("pending");
        }
        rr.setCreatedAt(Instant.now());
        rr.setUpdatedAt(Instant.now());
        if (rr.getTimeline() == null) {
            rr.setTimeline("[]");
        }
        addTimeline(rr, "pending", "Return request submitted", userId, "user");

        ReturnRequestEntity saved = returnRequestRepository.save(rr);
        domainEventPublisher.publish(new ReturnSubmittedEvent(userId, order.getId(), saved.getId(), dispute.getId()));
        return saved;
    }

    private ReturnRequestEntity copyTemplate(ReturnRequestEntity src) {
        ReturnRequestEntity rr = new ReturnRequestEntity();
        rr.setSellerId(src.getSellerId());
        rr.setItems(src.getItems());
        rr.setReason(src.getReason());
        rr.setReasonCategory(src.getReasonCategory());
        rr.setDescription(src.getDescription());
        rr.setImages(src.getImages());
        rr.setRefundMethod(src.getRefundMethod());
        return rr;
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
