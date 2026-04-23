package com.oceanbazar.backend.adapter;

import com.oceanbazar.backend.entity.ShipmentEntity;
import com.oceanbazar.backend.entity.enums.ShipmentStatus;
import org.springframework.stereotype.Service;

@Service
public class PathaoCourierAdapter implements CourierAdapter {
    @Override
    public ShipmentEntity createShipment(ShipmentEntity shipment) {
        // Placeholder for Pathao createShipment
        return new ShipmentEntity();
    }

    @Override
    public ShipmentEntity trackShipment(String trackingNumber) {
        // Placeholder: return dummy tracking info as ShipmentEntity
        ShipmentEntity mock = new ShipmentEntity();
        mock.setTrackingNumber(trackingNumber);
        mock.setStatus(ShipmentStatus.in_transit);
        return mock;
    }

    @Override
    public void updateStatus(String shipmentId, String status, String location, String description) {
        // Placeholder for Pathao updateStatus
    }

    @Override
    public String getProvider() {
        return "pathao";
    }
}
