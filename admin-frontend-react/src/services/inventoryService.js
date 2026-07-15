import { api } from "../lib/api";
import { normalizeInventoryItem, normalizeInventoryTransaction } from "../lib/normalize";

function mapList(data) {
  const rows = Array.isArray(data) ? data : data?.items || [];
  return rows.map(normalizeInventoryItem);
}

export const inventoryService = {
  list: () => api.get("/api/admin/inventory").then((r) => mapList(r.data)),
  listByProduct: (productId) =>
    api.get(`/api/admin/inventory/product/${productId}`).then((r) => mapList(r.data)),
  lowStock: (threshold = 10) =>
    api.get("/api/admin/inventory/low-stock", { params: { threshold } }).then((r) => mapList(r.data)),
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
