# OceanBazar real-time and environment matrix

## Service URLs and environment variables

| Client | Variable | Default (dev) | Notes |
|--------|----------|---------------|--------|
| Storefront (CRA) | `REACT_APP_BACKEND_URL` | `https://localhost:8000` | REST + SSE base; see [`frontend/src/api/service.js`](../frontend/src/api/service.js) |
| Admin (Vite) | `VITE_ADMIN_API_URL` | (none; falls back below) | Build-time embed |
| Admin runtime override | `localStorage.oceanbazar_admin_api` | — | Requires full page reload after change; Axios `baseURL` is fixed at module load in [`admin-frontend-react/src/lib/api.js`](../admin-frontend-react/src/lib/api.js) |
| Admin WS/SSE helpers | Same as above via `getApiBase()` / `getToken()` | [`useAdminRealtimeSocket.js`](../admin-frontend-react/src/hooks/useAdminRealtimeSocket.js), [`useAdminLive.js`](../admin-frontend-react/src/hooks/useAdminLive.js) |
| Backend HTTP | `server.port` | `8000` | [`application.properties`](../backend-java/src/main/resources/application.properties) |
| MongoDB | `MONGO_URL`, `DB_NAME` | `mongodb://127.0.0.1:27017`, `oceanbazar` | |
| CORS (REST) | `CORS_ALLOWED_ORIGINS` | localhost:3000, 5173, … | |
| WebSocket origins | `WEBSOCKET_ALLOWED_ORIGINS` | Same pattern | Must include admin + storefront origins |

## Real-time surfaces (backend)

| Path | Transport | Audience |
|------|-----------|----------|
| `/api/notifications/stream` | SSE (`notification`, `order_update`, `return_update`) | Logged-in customer |
| `/api/chat/stream` | SSE | Customer chat session |
| `/api/admin/live/stream` | SSE | Admin dashboard snapshot |
| `/api/admin/chat/stream` | SSE | Admin chat list |
| `/ws` | STOMP over SockJS | Admin topics `/topic/admin/*` |

Prometheus metrics (Micrometer) use names prefixed `oceanbazar.realtime.*` — scrape `/actuator/prometheus`.

## Customer return / RMA UI map (storefront)

| User flow | File | API called |
|-----------|------|------------|
| Order detail — Request return/refund | [`frontend/src/pages/OrderDetail.jsx`](../frontend/src/pages/OrderDetail.jsx) | `profileAPI.requestReturn` → `POST /api/profile/orders/{orderId}/return-request` |
| Open dispute form | [`frontend/src/pages/OpenDispute.jsx`](../frontend/src/pages/OpenDispute.jsx) | Same `profileAPI.requestReturn` with structured reason JSON |
| Dedicated returns page | [`frontend/src/pages/ReturnRequestPage.jsx`](../frontend/src/pages/ReturnRequestPage.jsx) | `returnAPI.create` / `returnAPI.list` → `/api/returns` |

Backend unification: both profile and `/api/returns` customer create paths delegate to a single orchestration service so `Order`, `Dispute`, and `ReturnRequest` stay aligned.

## Observability and verification

- Scrape Prometheus metrics from `https://<api-host>:8000/actuator/prometheus` and filter `oceanbazar_realtime_*`.
- After code changes, run `mvn compile` and smoke-test: place order (stock path), submit return from both Order detail and Returns page, send chat as customer and confirm admin chat list updates without relying only on polling.
- For multi-instance deployments, document sticky sessions for customer SSE or plan Redis/broker-backed fan-out (see hub Javadoc on `CustomerNotificationHub`).
