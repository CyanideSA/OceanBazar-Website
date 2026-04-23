import { api } from "../lib/api";

export const reviewService = {
  list: (status) => api.get("/api/admin/reviews", { params: status ? { status } : {} }).then((r) => r.data),
  pending: () => api.get("/api/admin/reviews/pending").then((r) => r.data),
  byProduct: (productId) => api.get(`/api/admin/reviews/product/${productId}`).then((r) => r.data),
  moderate: (id, status, note) => api.patch(`/api/admin/reviews/${id}/moderate`, { status, note }).then((r) => r.data),
};
