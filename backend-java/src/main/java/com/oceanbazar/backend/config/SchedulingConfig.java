package com.oceanbazar.backend.config;

import com.oceanbazar.backend.service.DomainEventService;
import com.oceanbazar.backend.service.InventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.util.concurrent.atomic.AtomicBoolean;

@Configuration
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
public class SchedulingConfig {
    private final InventoryService inventoryService;
    private final DomainEventService domainEventService;
    private final AtomicBoolean domainEventJobRunning = new AtomicBoolean(false);

    @Scheduled(fixedDelayString = "${oceanbazar.inventory.reservation-cleanup-ms:60000}")
    public void releaseExpiredReservations() {
        try {
            inventoryService.releaseExpiredReservations();
        } catch (Exception e) {
            log.warn("Error releasing expired reservations: {}", e.getMessage());
        }
    }

    @Scheduled(fixedDelayString = "${oceanbazar.events.process-interval-ms:5000}")
    public void processPendingEvents() {
        if (!domainEventJobRunning.compareAndSet(false, true)) {
            return;
        }
        try {
            var pending = domainEventService.getPendingEvents();
            for (var event : pending) {
                try {
                    domainEventService.markProcessed(event.getId());
                } catch (Exception e) {
                    domainEventService.markFailed(event.getId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Error processing domain events: {}", e.getMessage());
        } finally {
            domainEventJobRunning.set(false);
        }
    }
}
