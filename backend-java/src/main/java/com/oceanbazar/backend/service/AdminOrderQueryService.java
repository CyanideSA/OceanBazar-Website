package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.OrderFeedbackEntity;
import com.oceanbazar.backend.entity.OrderTimelineEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.entity.enums.OrderStatus;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminOrderQueryService {

    private static final List<OrderStatus> PIPELINE_STATUSES = List.of(
            OrderStatus.pending, OrderStatus.confirmed, OrderStatus.processing
    );

    private final EntityManager entityManager;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    public List<OrderEntity> getOrders(String status) {
        if (status == null || status.isBlank()) {
            return orderRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
        }

        String s = status.trim().toLowerCase();
        List<OrderStatus> statuses;

        if ("pipeline".equals(s) || "pre_fulfillment".equals(s)) {
            statuses = PIPELINE_STATUSES;
        } else if ("cancelled".equals(s)) {
            statuses = List.of(OrderStatus.cancelled, OrderStatus.returned);
        } else {
            try {
                OrderStatus os = OrderStatus.valueOf(s);
                statuses = List.of(os);
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown status filter");
            }
        }

        TypedQuery<OrderEntity> q = entityManager.createQuery(
                "SELECT o FROM OrderEntity o WHERE o.status IN (:statuses) ORDER BY o.createdAt DESC",
                OrderEntity.class);
        q.setParameter("statuses", statuses);
        return q.getResultList();
    }

    public Map<String, Object> getOrderDetail(String id) {
        OrderEntity order = orderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        UserEntity user = userRepository.findById(order.getUserId()).orElse(null);

        TypedQuery<OrderFeedbackEntity> fbQuery = entityManager.createQuery(
                "SELECT f FROM OrderFeedbackEntity f WHERE f.orderId = :orderId",
                OrderFeedbackEntity.class);
        fbQuery.setParameter("orderId", order.getId());
        fbQuery.setMaxResults(1);
        List<OrderFeedbackEntity> feedbackList = fbQuery.getResultList();
        OrderFeedbackEntity feedback = feedbackList.isEmpty() ? null : feedbackList.get(0);

        Map<String, Object> out = new HashMap<>();
        out.put("order", order);
        out.put("customer", user == null ? null : stripPasswordHash(user));
        out.put("timeline", buildTimelineForResponse(order));
        out.put("statusHistory", buildStatusHistoryFromTimeline(order));
        out.put("buyerFeedback", buildBuyerFeedbackSummary(feedback));
        return out;
    }

    private UserEntity stripPasswordHash(UserEntity src) {
        if (src == null) return null;
        UserEntity out = new UserEntity();
        BeanUtils.copyProperties(src, out);
        out.setPasswordHash(null);
        return out;
    }

    private List<Map<String, Object>> buildTimelineForResponse(OrderEntity order) {
        List<OrderTimelineEntity> raw = order.getTimeline();
        if (raw != null && !raw.isEmpty()) {
            return raw.stream()
                    .sorted(Comparator.comparing(e -> e.getCreatedAt() == null ? Instant.EPOCH : e.getCreatedAt()))
                    .map(this::timelineEntryToMap)
                    .toList();
        }
        List<Map<String, Object>> synthetic = new ArrayList<>();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", "legacy-placeholder");
        m.put("eventType", "created");
        m.put("at", order.getCreatedAt() != null ? Date.from(order.getCreatedAt()) : new Date());
        m.put("status", order.getStatus() != null ? order.getStatus().name() : OrderStatus.pending.name());
        m.put("note", "Order placed");
        synthetic.add(m);
        return synthetic;
    }

    private List<Map<String, Object>> buildStatusHistoryFromTimeline(OrderEntity order) {
        List<OrderTimelineEntity> t = order.getTimeline();
        List<Map<String, Object>> out = new ArrayList<>();

        if (t == null || t.isEmpty()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", "legacy-placeholder");
            m.put("at", order.getCreatedAt() != null ? Date.from(order.getCreatedAt()) : new Date());
            m.put("fromStatus", null);
            m.put("toStatus", order.getStatus() != null ? order.getStatus().name() : OrderStatus.pending.name());
            m.put("note", "Order placed");
            m.put("actorId", null);
            out.add(m);
            return out;
        }

        List<OrderTimelineEntity> sorted = new ArrayList<>(t);
        sorted.sort(Comparator.comparing(e -> e.getCreatedAt() == null ? Instant.EPOCH : e.getCreatedAt()));

        String previousStatus = null;
        for (OrderTimelineEntity e : sorted) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getId());
            m.put("at", e.getCreatedAt() != null ? Date.from(e.getCreatedAt()) : null);
            m.put("fromStatus", previousStatus);
            m.put("toStatus", e.getStatus());
            m.put("note", e.getNote());
            m.put("actorId", e.getActorId());
            out.add(m);
            previousStatus = e.getStatus();
        }

        if (out.isEmpty()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", "legacy-placeholder");
            m.put("at", order.getCreatedAt() != null ? Date.from(order.getCreatedAt()) : new Date());
            m.put("fromStatus", null);
            m.put("toStatus", order.getStatus() != null ? order.getStatus().name() : OrderStatus.pending.name());
            m.put("note", "Order placed");
            m.put("actorId", null);
            out.add(m);
        }
        return out;
    }

    private Map<String, Object> buildBuyerFeedbackSummary(OrderFeedbackEntity feedback) {
        Map<String, Object> m = new LinkedHashMap<>();
        boolean has = feedback != null;
        m.put("submitted", has);
        m.put("rating", has ? feedback.getRating() : null);
        m.put("comment", has ? feedback.getComment() : null);
        m.put("submittedAt", has && feedback.getCreatedAt() != null ? Date.from(feedback.getCreatedAt()) : null);
        return m;
    }

    private Map<String, Object> timelineEntryToMap(OrderTimelineEntity e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.getId());
        m.put("at", e.getCreatedAt() != null ? Date.from(e.getCreatedAt()) : null);
        m.put("status", e.getStatus());
        m.put("note", e.getNote());
        m.put("actorId", e.getActorId());
        m.put("actorType", e.getActorType() != null ? e.getActorType().name() : null);
        return m;
    }
}
