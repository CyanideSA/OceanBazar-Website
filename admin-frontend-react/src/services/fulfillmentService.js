import { api } from "../lib/api";

export const fulfillmentService = {
  listShipments: (status) => api.get("/api/admin/fulfillment/shipments", { params: status ? { status } : {} }).then((r) => r.data),
  getShipment: (id) => api.get(`/api/admin/fulfillment/shipments/${id}`).then((r) => r.data),
  shipmentsByOrder: (orderId) => api.get(`/api/admin/fulfillment/shipments/order/${orderId}`).then((r) => r.data),
  createShipment: (data) => api.post("/api/admin/fulfillment/shipments", data).then((r) => r.data),
  updateShipmentStatus: (id, status, location, description) => api.patch(`/api/admin/fulfillment/shipments/${id}/status`, { status, location, description }).then((r) => r.data),
  updateTracking: (id, carrier, trackingNumber, trackingUrl) => api.put(`/api/admin/fulfillment/shipments/${id}/tracking`, { carrier, trackingNumber, trackingUrl }).then((r) => r.data),
  deleteShipment: (id) => api.delete(`/api/admin/fulfillment/shipments/${id}`).then((r) => r.data),
};
