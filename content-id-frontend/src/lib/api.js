import axios from "axios";
import { clearSession, getToken } from "./auth";

export function resolveApiBase() {
  if (typeof window === "undefined") {
    return (import.meta.env.VITE_CONTENT_ID_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
  }

  const pagePort = window.location.port;
  const sameOrigin =
    import.meta.env.VITE_CONTENT_ID_API_SAME_ORIGIN === "true" ||
    pagePort === "5180" ||
    pagePort === "4000";

  if (sameOrigin) return window.location.origin;
  return (import.meta.env.VITE_CONTENT_ID_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
}

export const api = axios.create({
  baseURL: resolveApiBase(),
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  config.baseURL = resolveApiBase();
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      clearSession();
      window.dispatchEvent(new CustomEvent("content-id-auth-cleared"));
    }
    return Promise.reject(err);
  },
);

export const contentIdApi = {
  ssoStatus: () => api.get("/api/content-id/auth/sso/status").then((r) => r.data),
  ssoExchange: (code) =>
    api.post("/api/content-id/auth/sso/exchange", { code }).then((r) => r.data),
  me: () => api.get("/api/content-id/auth/me").then((r) => r.data),
  catalog: () => api.get("/api/content-id/catalog").then((r) => r.data),
  suggest: () => api.get("/api/content-id/suggest").then((r) => r.data),
  createCategory: (payload) =>
    api.post("/api/content-id/catalog/categories", payload).then((r) => r.data),
  createSubcategory: (payload) =>
    api.post("/api/content-id/catalog/subcategories", payload).then((r) => r.data),
  createBrand: (payload) =>
    api.post("/api/content-id/catalog/brands", payload).then((r) => r.data),
  generate: (payload) => api.post("/api/content-id/generate", payload).then((r) => r.data),
  mine: () => api.get("/api/content-id/mine").then((r) => r.data),
};

export function microsoftSsoStartUrl() {
  return `${resolveApiBase()}/api/content-id/auth/sso/microsoft/start`;
}
