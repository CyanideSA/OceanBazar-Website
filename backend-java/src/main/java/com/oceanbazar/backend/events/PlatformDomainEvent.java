package com.oceanbazar.backend.events;

import java.util.Map;

public record PlatformDomainEvent(DomainEventType type, Map<String, Object> body) {}
