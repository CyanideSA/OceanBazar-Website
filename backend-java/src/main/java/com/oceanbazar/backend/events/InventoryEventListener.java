package com.oceanbazar.backend.events;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Example Java-side consumer for domain events (inventory / fulfillment reactions).
 */
@Component
@Slf4j
public class InventoryEventListener {

    @Async
    @EventListener
    public void onPlatformEvent(PlatformDomainEvent event) {
        if (event.type() == DomainEventType.ShipmentCreated || event.type() == DomainEventType.OrderPlaced) {
            log.debug("Inventory listener received {}", event.type());
        }
    }
}
