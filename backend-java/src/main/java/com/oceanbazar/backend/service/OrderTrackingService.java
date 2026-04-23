package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.OrderDtos;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.OrderTimelineEntity;
import com.oceanbazar.backend.entity.enums.OrderStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Objects;

/**
 * Builds customer-facing shipment tracking from persisted {@link OrderEntity} timeline
 * and timestamps on the order itself.
 */
@Service
public class OrderTrackingService {

    private static final String[] STEP_KEYS = {
            "placed", "processing", "shipped", "out_for_delivery", "delivered"
    };

    private static final String[] STEP_LABELS = {
            "Order Placed",
            "Processing",
            "Shipped",
            "Out for Delivery",
            "Delivered"
    };

    public OrderDtos.OrderTrackingResponseDto buildTracking(OrderEntity order) {
        OrderDtos.OrderTrackingResponseDto out = new OrderDtos.OrderTrackingResponseDto();
        out.setOrderId(order.getId());
        out.setOrderNumber(order.getOrderNumber());
        out.setStatus(order.getStatus() != null ? order.getStatus().name() : null);
        out.setTrackingNumber(order.getTrackingNumber());
        out.setCreatedAt(order.getCreatedAt() == null ? null : Date.from(order.getCreatedAt()));

        int current = fulfillmentStepIndex(order.getStatus() != null ? order.getStatus().name() : null);
        out.setCancelled(current < 0);
        out.setCurrentStepIndex(out.isCancelled() ? -1 : current);

        Instant[] firstAt = new Instant[STEP_KEYS.length];
        firstAt[0] = order.getCreatedAt() != null ? order.getCreatedAt() : Instant.EPOCH;

        List<OrderTimelineEntity> timeline = order.getTimeline();
        if (timeline != null) {
            List<OrderTimelineEntity> sorted = timeline.stream()
                    .filter(Objects::nonNull)
                    .sorted(Comparator.comparing(OrderTimelineEntity::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList();
            for (OrderTimelineEntity h : sorted) {
                int milestone = milestoneIndexForToStatus(h.getStatus());
                if (milestone < 0 || h.getCreatedAt() == null) {
                    continue;
                }
                if (milestone < STEP_KEYS.length
                        && (firstAt[milestone] == null || h.getCreatedAt().isBefore(firstAt[milestone]))) {
                    firstAt[milestone] = h.getCreatedAt();
                }
            }
        }

        Instant last = firstAt[0];
        for (int i = 1; i < STEP_KEYS.length; i++) {
            if (firstAt[i] != null) {
                last = firstAt[i];
            } else if (last != null && !out.isCancelled() && current >= i) {
                firstAt[i] = last;
            }
        }

        if (!out.isCancelled() && current > 0 && firstAt[current] == null) {
            firstAt[current] = last != null ? last : firstAt[0];
        }

        List<OrderDtos.OrderTrackingStepDto> steps = new ArrayList<>();
        for (int i = 0; i < STEP_KEYS.length; i++) {
            OrderDtos.OrderTrackingStepDto sd = new OrderDtos.OrderTrackingStepDto();
            sd.setKey(STEP_KEYS[i]);
            sd.setLabel(STEP_LABELS[i]);
            boolean completed = !out.isCancelled() && i <= current;
            sd.setCompleted(completed);
            sd.setCurrent(!out.isCancelled() && i == current);
            sd.setOccurredAt(firstAt[i] == null ? null : Date.from(firstAt[i]));
            sd.setDetail(stepDetail(i, order));
            steps.add(sd);
        }
        out.setSteps(steps);
        out.setEvents(buildEventLog(order));
        return out;
    }

    private static String stepDetail(int index, OrderEntity order) {
        if (index == 2 || index == 3 || index == 4) {
            String tn = order.getTrackingNumber();
            if (tn != null && !tn.isBlank()) {
                return "Tracking: " + tn.trim();
            }
        }
        return null;
    }

    private static int milestoneIndexForToStatus(String toStatus) {
        if (toStatus == null || toStatus.isBlank()) {
            return -1;
        }
        String n = toStatus.trim().toLowerCase().replace("-", "_").replace(' ', '_');
        return switch (n) {
            case "pending" -> 0;
            case "confirmed", "processing" -> 1;
            case "shipped" -> 2;
            case "out_for_delivery", "in_transit" -> 3;
            case "delivered" -> 4;
            case "cancelled", "refunded" -> -1;
            default -> -1;
        };
    }

    public static int fulfillmentStepIndex(String status) {
        if (status == null || status.isBlank()) {
            return 0;
        }
        String s = status.trim().toLowerCase().replace("-", "_").replace(' ', '_');
        if ("cancelled".equals(s) || "refunded".equals(s)) {
            return -1;
        }
        if ("delivered".equals(s)) {
            return 4;
        }
        if ("out_for_delivery".equals(s) || "in_transit".equals(s)) {
            return 3;
        }
        if ("shipped".equals(s)) {
            return 2;
        }
        if ("processing".equals(s) || "confirmed".equals(s)) {
            return 1;
        }
        try {
            OrderStatus os = OrderStatus.valueOf(s);
            return switch (os) {
                case delivered -> 4;
                case shipped -> 2;
                case processing, confirmed -> 1;
                case pending -> 0;
                case cancelled, returned -> -1;
            };
        } catch (IllegalArgumentException e) {
            return 0;
        }
    }

    private List<OrderDtos.OrderTrackingLogEntryDto> buildEventLog(OrderEntity order) {
        List<OrderDtos.OrderTrackingLogEntryDto> list = new ArrayList<>();

        List<OrderTimelineEntity> timeline = order.getTimeline();
        if (timeline != null) {
            for (OrderTimelineEntity e : timeline) {
                if (e == null || e.getCreatedAt() == null) {
                    continue;
                }
                OrderDtos.OrderTrackingLogEntryDto dto = new OrderDtos.OrderTrackingLogEntryDto();
                dto.setAt(e.getCreatedAt() == null ? null : Date.from(e.getCreatedAt()));
                dto.setType("status");
                dto.setMessage(e.getNote() != null && !e.getNote().isBlank()
                        ? e.getNote().trim()
                        : "Status updated → " + (e.getStatus() != null ? e.getStatus() : "unknown"));
                dto.setStatus(e.getStatus());
                dto.setPreviousStatus(null);
                list.add(dto);
            }
        }

        list.sort(Comparator.comparing(OrderDtos.OrderTrackingLogEntryDto::getAt, Comparator.nullsLast(Comparator.naturalOrder())));
        if (list.size() > 80) {
            return list.subList(list.size() - 80, list.size());
        }
        return list;
    }
}
