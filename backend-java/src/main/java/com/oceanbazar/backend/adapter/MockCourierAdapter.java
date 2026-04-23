package com.oceanbazar.backend.adapter;

import com.oceanbazar.backend.entity.ShipmentEntity;
import com.oceanbazar.backend.entity.enums.ShipmentStatus;
import org.springframework.stereotype.Service;

@Service
public class MockCourierAdapter implements CourierAdapter {
    @Override
    public ShipmentEntity createShipment(ShipmentEntity shipment) {
        // Mock: return a dummy shipment with success status
        ShipmentEntity mockShipment = new ShipmentEntity();
        mockShipment.setTrackingNumber("MOCK-TRACK-12345");
        mockShipment.setStatus(ShipmentStatus.pending);
        return mockShipment;
    }

    @Override
    public ShipmentEntity trackShipment(String trackingNumber) {
        // Mock: return a dummy shipment status
        ShipmentEntity mockShipment = new ShipmentEntity();
        mockShipment.setTrackingNumber(trackingNumber);
        mockShipment.setStatus(ShipmentStatus.in_transit);
        return mockShipment;
    }

    @Override
    public void updateStatus(String shipmentId, String status, String location, String description) {
        // Mock: no-op for update, log or simulate in real impl
    }

    @Override
    public String getProvider() {
        return "mock";
    }
}
