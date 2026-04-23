package com.oceanbazar.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oceanbazar.backend.adapter.CourierAdapter;
import com.oceanbazar.backend.entity.ShipmentEntity;
import com.oceanbazar.backend.entity.enums.ShipmentStatus;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.ShipmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FulfillmentService {
    private final ShipmentRepository shipmentRepository;
    private final OrderRepository orderRepository;
    private final ObjectMapper objectMapper;
    private final List<CourierAdapter> courierAdapters;

    public List<ShipmentEntity> listAll() {
        return shipmentRepository.findAll();
    }

    public List<ShipmentEntity> listByOrder(String orderId) {
        return shipmentRepository.findByOrderId(orderId);
    }

    public List<ShipmentEntity> listByStatus(ShipmentStatus status) {
        return shipmentRepository.findByStatus(status);
    }

    public ShipmentEntity getById(String id) {
        return shipmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shipment not found"));
    }

    public ShipmentEntity createShipment(ShipmentEntity shipment) {
        ShipmentEntity created = selectAdapter(shipment.getCarrier()).createShipment(shipment);
        created.setCreatedAt(Instant.now());
        created.setUpdatedAt(Instant.now());
        addEvent(created, created.getStatus().name(), null, "Shipment created via adapter");
        return shipmentRepository.save(created);
    }

    public ShipmentEntity trackShipment(String trackingNumber) {
        ShipmentEntity shipment = shipmentRepository.findByTrackingNumber(trackingNumber).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shipment not found"));
        return selectAdapter(shipment.getCarrier()).trackShipment(trackingNumber);
    }

    public ShipmentEntity updateStatus(String id, String status, String location, String description) {
        ShipmentEntity shipment = getById(id);
        selectAdapter(shipment.getCarrier()).updateStatus(id, status, location, description);
        shipment.setStatus(parseShipmentStatus(status));
        shipment.setUpdatedAt(Instant.now());
        addEvent(shipment, status, location, description);
        ShipmentEntity saved = shipmentRepository.save(shipment);
        syncOrderTrackingFromShipment(saved);
        return saved;
    }

    public ShipmentEntity updateTracking(String id, String carrier, String trackingNumber) {
        ShipmentEntity shipment = getById(id);
        shipment.setCarrier(carrier);
        shipment.setTrackingNumber(trackingNumber);
        shipment.setUpdatedAt(Instant.now());
        ShipmentEntity saved = shipmentRepository.save(shipment);
        syncOrderTrackingFromShipment(saved);
        return saved;
    }

    public void deleteShipment(String id) {
        ShipmentEntity shipment = getById(id);
        String orderId = shipment.getOrderId();
        String tn = shipment.getTrackingNumber();
        shipmentRepository.deleteById(id);
        if (orderId != null && !orderId.isBlank() && tn != null && !tn.isBlank()) {
            orderRepository.findById(orderId.trim()).ifPresent(o -> {
                if (tn.equals(o.getTrackingNumber())) {
                    o.setTrackingNumber(null);
                    orderRepository.save(o);
                }
            });
        }
    }

    private void syncOrderTrackingFromShipment(ShipmentEntity shipment) {
        String orderId = shipment.getOrderId();
        if (orderId == null || orderId.isBlank()) {
            return;
        }
        String tn = shipment.getTrackingNumber();
        if (tn == null || tn.isBlank()) {
            return;
        }
        orderRepository.findById(orderId).ifPresent(o -> {
            if (tn.equals(o.getTrackingNumber())) {
                return;
            }
            o.setTrackingNumber(tn);
            orderRepository.save(o);
        });
    }

    private void addEvent(ShipmentEntity shipment, String status, String location, String description) {
        List<Map<String, Object>> events;
        try {
            events = shipment.getEvents() != null
                    ? objectMapper.readValue(shipment.getEvents(), new TypeReference<>() {})
                    : new ArrayList<>();
        } catch (Exception e) {
            events = new ArrayList<>();
        }
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("id", UUID.randomUUID().toString());
        event.put("at", Instant.now().toString());
        event.put("status", status);
        event.put("location", location);
        event.put("description", description);
        events.add(event);
        try {
            shipment.setEvents(objectMapper.writeValueAsString(events));
        } catch (Exception ignored) {
        }
    }

    private static ShipmentStatus parseShipmentStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return ShipmentStatus.pending;
        }
        String s = raw.trim().toLowerCase().replace('-', '_');
        return ShipmentStatus.valueOf(s);
    }

    private CourierAdapter selectAdapter(String provider) {
        return courierAdapters.stream()
                .filter(a -> a.getProvider().equals(provider))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No courier adapter found for provider: " + provider));
    }
}
