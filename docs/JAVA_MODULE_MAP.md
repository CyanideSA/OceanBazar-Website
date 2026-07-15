# Java modular monolith map (Phase 2)

Package-by-feature layout under `com.oceanbazar.backend`. Existing classes remain in legacy packages until moved incrementally.

| Module | Responsibility | Legacy packages |
|--------|----------------|-----------------|
| **catalog** | Products, categories, brands, search | `controller/Product*`, `Category*`, `AdminBrand*` |
| **orders** | Cart, checkout, order lifecycle | `OrderController`, `CartController`, `OrderService` |
| **payments** | Gateways, settlement | `PaymentController` |
| **fulfillment** | Shipments, couriers | `FulfillmentService`, `adapter/*Courier*` |
| **pricing** | Tiers, wholesale rules | `PricingService`, `ProductPricing*` |
| **wholesale** | B2B applications | `WholesaleController` |
| **crm** | Customers, admin users | `AdminController`, `Customer*` |
| **analytics** | Dashboards, metrics | `AdminAnalyticsController` |
| **support** | Tickets, chat | `TicketController`, `ChatController` |
| **realtime** | Redis → BFF bridge | `realtime/RealtimeRedisPublisher`, `WebSocketBroadcastService` |
| **events** | Domain events | `events/DomainEventPublisher` |

## Coupling rules

- Modules must not inject another module's concrete `@Service` — use interfaces or domain events.
- Cross-module workflows: `DomainEventPublisher` + `PlatformDomainEvent` listeners.

## New code location

Place new types under `com.oceanbazar.backend.<module>.*` with:

```
controller/
service/
repository/
dto/
events/
```
