import { api } from "../lib/api";
import { normalizeInventoryItem, normalizeInventoryTransaction } from "../lib/normalize";

function mapList(data) {
  const rows = Array.isArray(data) ? data : data?.items || [];
  return rows.map(normalizeInventoryItem);
}

function mapPaginated(data) {
  return {
    items: mapList(data),
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    limit: data?.limit ?? 20,
  };
}

export const inventoryService = {
  list: (params = {}) =>
    api.get("/api/admin/inventory", { params }).then((r) => mapPaginated(r.data)),
  listByProduct: (productId) =>
    api.get(`/api/admin/inventory/product/${productId}`).then((r) => mapList(r.data)),
  lowStock: (params = {}) =>
    api.get("/api/admin/inventory/low-stock", { params }).then((r) => mapPaginated(r.data)),
  analytics: () => api.get("/api/admin/inventory/analytics").then((r) => r.data),
  detail: (itemId) =>
    api.get(`/api/admin/inventory/${itemId}`).then((r) => ({
      item: normalizeInventoryItem(r.data?.item),
      transactions: (r.data?.transactions || []).map(normalizeInventoryTransaction),
    })),
  adjustStock: (itemId, quantity, type, note) =>
    api.post(`/api/admin/inventory/${itemId}/adjust`, {
      quantity: Math.abs(Number(quantity)),
      type: type === "add" ? "add" : "deduct",
      note,
    }).then((r) => ({
      item: normalizeInventoryItem(r.data?.item),
    })),
  setQuantity: (itemId, newQuantity, note) =>
    api.post(`/api/admin/inventory/${itemId}/set-quantity`, { newQuantity, note }).then((r) => ({
      item: normalizeInventoryItem(r.data?.item),
    })),
  transactions: (productId) =>
    api.get(`/api/admin/inventory/transactions/${productId}`).then((r) => {
      const rows = Array.isArray(r.data) ? r.data : r.data?.transactions || [];
      return rows.map(normalizeInventoryTransaction);
    }),
};
