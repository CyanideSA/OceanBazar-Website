import { api } from "../lib/api";

export const returnService = {
  list: (status) => api.get("/api/admin/returns", { params: status ? { status } : {} }).then((r) => r.data),
  getById: (id) => api.get(`/api/admin/returns/${id}`).then((r) => r.data),
  updateStatus: (id, status, note) => api.patch(`/api/admin/returns/${id}/status`, { status, note }).then((r) => r.data),
  processRefund: (id, amount, method) => api.post(`/api/admin/returns/${id}/refund`, { amount, method }).then((r) => r.data),
};
