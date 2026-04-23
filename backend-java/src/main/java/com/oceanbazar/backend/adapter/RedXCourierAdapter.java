package com.oceanbazar.backend.adapter;

import com.oceanbazar.backend.entity.ShipmentEntity;
import com.oceanbazar.backend.entity.enums.ShipmentStatus;
import org.springframework.stereotype.Service;

@Service
public class RedXCourierAdapter implements CourierAdapter {
    @Override
    public ShipmentEntity createShipment(ShipmentEntity shipment) {
        // Placeholder: return dummy shipment for RedX
        ShipmentEntity mockShipment = new ShipmentEntity();
        mockShipment.setTrackingNumber("REDX-TRACK-67890");
        mockShipment.setStatus(ShipmentStatus.pending);  // Changed from ShipmentStatus.CREATED
        return mockShipment;
    }

    @Override
    public ShipmentEntity trackShipment(String trackingNumber) {
        // Placeholder: return dummy status for RedX
        ShipmentEntity mockShipment = new ShipmentEntity();
        mockShipment.setStatus(ShipmentStatus.in_transit);  // Changed from ShipmentStatus.IN_TRANSIT
        return mockShipment;
    }

    @Override
    public void updateStatus(String shipmentId, String status, String location, String description) {
        // Placeholder: no-op for update in RedX adapter
    }

    @Override
    public String getProvider() {
        return "redx";
    }
}
