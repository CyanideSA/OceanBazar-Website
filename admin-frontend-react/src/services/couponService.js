import { api } from "../lib/api";

export const couponService = {
  list: () => api.get("/api/admin/coupons").then((r) => r.data),
  listActive: () => api.get("/api/admin/coupons/active").then((r) => r.data),
  create: (data) => api.post("/api/admin/coupons", data).then((r) => r.data),
  update: (id, data) => api.put(`/api/admin/coupons/${id}`, data).then((r) => r.data),
  validate: (code, total) => api.post("/api/admin/coupons/validate", { code, total }).then((r) => r.data),
  delete: (id) => api.delete(`/api/admin/coupons/${id}`).then((r) => r.data),
};
