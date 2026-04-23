package com.oceanbazar.backend.adapter;

import com.oceanbazar.backend.entity.ShipmentEntity;

public interface CourierAdapter {
    ShipmentEntity createShipment(ShipmentEntity shipment);
    ShipmentEntity trackShipment(String trackingNumber);
    void updateStatus(String shipmentId, String status, String location, String description);
    String getProvider();
}
