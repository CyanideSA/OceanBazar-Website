import { api } from "../lib/api";

export const analyticsService = {
  dashboard: () => api.get("/api/admin/analytics/dashboard").then((r) => r.data),
  sales: (days = 30, grain = "day") =>
    api.get("/api/admin/analytics/sales", { params: { days, grain } }).then((r) => r.data),
  customerGrowth: (days = 30, grain = "day") =>
    api.get("/api/admin/analytics/customer-growth", { params: { days, grain } }).then((r) => r.data),
  topProducts: (limit = 10) => api.get("/api/admin/analytics/top-products", { params: { limit } }).then((r) => r.data),
  customers: () => api.get("/api/admin/analytics/customers").then((r) => r.data),
};
