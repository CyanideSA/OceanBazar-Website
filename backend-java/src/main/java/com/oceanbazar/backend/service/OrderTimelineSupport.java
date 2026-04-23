package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.OrderTimelineEntity;
import com.oceanbazar.backend.entity.enums.ActorType;

import java.time.Instant;
import java.util.ArrayList;

final class OrderTimelineSupport {
    private OrderTimelineSupport() {}

    static void append(OrderEntity order, String status, String note, String actorId, ActorType actorType) {
        if (order == null || order.getId() == null) {
            return;
        }
        OrderTimelineEntity e = new OrderTimelineEntity();
        e.setOrderId(order.getId());
        e.setStatus(status != null ? status : "");
        e.setNote(note);
        e.setActorId(actorId);
        e.setActorType(actorType != null ? actorType : ActorType.system);
        e.setCreatedAt(Instant.now());
        if (order.getTimeline() == null) {
            order.setTimeline(new ArrayList<>());
        }
        order.getTimeline().add(e);
    }

    static void recordStatusTransition(OrderEntity order, String from, String to, String note, String actorId, ActorType actorType) {
        String msg = (note != null && !note.isBlank())
                ? note
                : ("Status " + from + " → " + to);
        append(order, to, msg, actorId, actorType != null ? actorType : ActorType.admin);
    }

    static void recordPaymentChange(OrderEntity order, String newPaymentWire, String note, String actorId, ActorType actorType) {
        String msg = (note != null && !note.isBlank())
                ? note
                : ("Payment status → " + newPaymentWire);
        append(order, "payment", msg, actorId, actorType != null ? actorType : ActorType.admin);
    }

    static void recordTrackingChange(OrderEntity order, String prev, String next, String note, String actorId) {
        String msg = (note != null && !note.isBlank())
                ? note
                : ("Tracking " + (prev == null ? "∅" : prev) + " → " + (next == null ? "∅" : next));
        append(order, "tracking", msg, actorId, ActorType.admin);
    }

    static void recordInitialPlaced(OrderEntity order) {
        append(order,
                order.getStatus() != null ? order.getStatus().name() : "pending",
                "Order placed",
                null,
                ActorType.system);
    }
}
