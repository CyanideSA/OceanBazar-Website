import { api } from "../lib/api";

export const inventoryService = {
  list: () => api.get("/api/admin/inventory").then((r) => r.data),
  listByProduct: (productId) => api.get(`/api/admin/inventory/product/${productId}`).then((r) => r.data),
  lowStock: (threshold = 10) => api.get("/api/admin/inventory/low-stock", { params: { threshold } }).then((r) => r.data),
  adjustStock: (itemId, quantity, note) => api.post(`/api/admin/inventory/${itemId}/adjust`, { quantity, note }).then((r) => r.data),
  setQuantity: (itemId, newQuantity, note) =>
    api.post(`/api/admin/inventory/${itemId}/set-quantity`, { newQuantity, note }).then((r) => r.data),
  transactions: (productId) => api.get(`/api/admin/inventory/transactions/${productId}`).then((r) => r.data),
};
