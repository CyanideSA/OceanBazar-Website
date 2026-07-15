package com.oceanbazar.backend.events;

public enum DomainEventType {
    OrderPlaced,
    OrderStatusChanged,
    OrderPaymentChanged,
    OrderTrackingChanged,
    PaymentConfirmed,
    ShipmentCreated,
    ProductImported,
    UserRegistered,
    PointsGranted,
    TicketCreated,
    CatalogChanged,
    ReturnSubmitted,
    ReturnStatusChanged,
    CustomerChatMessage
}
