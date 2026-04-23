/** Canonical id for API routes (`/orders/:id`). */
export function getOrderRouteId(order) {
  if (!order) return "";
  const id = order.id ?? order._id;
  return id != null && String(id).trim() !== "" ? String(id).trim() : "";
}

/**
 * Display code for orders: prefer API `orderNumber` (8 hex), else derive from Mongo id / UUID.
 */
export function getOrderDisplayCode(order) {
  if (!order) return "";
  const raw = order.orderNumber;
  if (raw != null && String(raw).trim() !== "") {
    return String(raw).trim().toUpperCase();
  }
  const id = String(order.id || "").replace(/-/g, "");
  if (id.length >= 8 && /^[0-9a-fA-F]+$/.test(id)) {
    return id.slice(-8).toUpperCase();
  }
  return id.slice(0, 8).toUpperCase() || "—";
}

/** Main heading, e.g. "Order: A3F9B2C1" */
export function formatOrderTitle(order) {
  const code = getOrderDisplayCode(order);
  return code && code !== "—" ? `Order: ${code}` : "Order";
}
