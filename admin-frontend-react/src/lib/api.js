import axios from "axios";
import { clearSession, getToken } from "./auth";

/** BFF on same host as CRM tab (avoids localhost vs 127.0.0.1 and empty baseURL → HTML from :5173). */
function localBffOrigin() {
  if (typeof window === "undefined") return "http://127.0.0.1:4000";
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:4000`;
}

function isLocalBffUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]") &&
      (u.port === "4000" || u.port === "")
    );
  } catch {
    return false;
  }
}

/** Remove CRM/static URLs mistakenly saved as API base (they return HTML, not JSON). */
export function sanitizeAdminApiStorage() {
  if (typeof localStorage === "undefined") return;
  for (const key of ["oceanbazar_admin_api", "oceanbazar_admin_api_url"]) {
    const v = localStorage.getItem(key);
    if (!v) continue;
    try {
      const u = new URL(v);
      if (u.port === "5173" || u.port === "5174" || u.pathname.endsWith(".html")) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
}

export function resolveAdminApiBase() {
  if (typeof window === "undefined") {
    return (import.meta.env.VITE_ADMIN_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
  }

  sanitizeAdminApiStorage();

  const pagePort = window.location.port;
  const sameOriginApi =
    import.meta.env.VITE_ADMIN_API_SAME_ORIGIN === "true" ||
    import.meta.env.VITE_ADMIN_API_SAME_ORIGIN === true ||
    pagePort === "5173" ||
    pagePort === "5174" ||
    pagePort === "4000";

  // CRM on :5173/:5174 (Docker server.mjs or Vite dev) proxies /api to BFF — use same origin.
  if (sameOriginApi) {
    return window.location.origin;
  }

  const fromEnv = (import.meta.env.VITE_ADMIN_API_URL || "").replace(/\/$/, "");
  const fromLs = localStorage.getItem("oceanbazar_admin_api");
  const lsIsLocal = fromLs && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/.test(fromLs);

  const isLocalPage = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i.test(window.location.origin);

  if (isLocalPage || isLocalBffUrl(fromEnv) || !fromEnv) {
    let port = "4000";
    if (fromEnv) {
      try {
        port = new URL(fromEnv).port || "4000";
      } catch { /* use default port */ }
    }
    const localBase = `${window.location.protocol}//${window.location.hostname}:${port}`;
    return localBase;
  }

  if (fromLs && !lsIsLocal) {
    try {
      const u = new URL(fromLs);
      if (u.port !== "5173" && u.port !== "5174") {
        return fromLs.replace(/\/$/, "");
      }
    } catch { /* fall through */ }
  }

  const base = fromEnv || localBffOrigin();
  return base.replace(/\/$/, "") || localBffOrigin();
}

export const api = axios.create({
  baseURL: resolveAdminApiBase(),
  headers: { "Content-Type": "application/json" }
});

function isPublicAdminAuthRequest(url) {
  const u = String(url || "");
  return (
    u.includes("/api/admin/auth/login") ||
    u.includes("/api/admin/auth/login-2fa") ||
    u.includes("/api/admin/auth/onboarding/") ||
    u.includes("/api/admin/auth/forgot-password") ||
    u.includes("/api/admin/auth/sso/exchange") ||
    u.includes("/api/admin/auth/sso/status")
  );
}

api.interceptors.request.use((config) => {
  config.baseURL = resolveAdminApiBase();
  const token = getToken();
  if (token && !isPublicAdminAuthRequest(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const rid =
    (typeof crypto !== "undefined" && crypto.randomUUID?.()) ||
    `adm-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  config.headers["X-Request-Id"] = rid;
  return config;
});

let authErrorHandled = false;
let lastLoginSuccessAt = 0;

export function markAdminLoginSuccess() {
  lastLoginSuccessAt = Date.now();
  authErrorHandled = false;
}

export function isWithinAdminLoginGrace() {
  return Date.now() - lastLoginSuccessAt < 8000;
}

function handleAuthError() {
  if (authErrorHandled) return;
  authErrorHandled = true;
  clearSession();
  // Notify App.jsx to switch back to LoginPage without a full reload —
  // a hard reload caused an infinite loop when multiple parallel requests
  // returned 401 simultaneously (each one triggered another reload).
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("admin-auth-cleared"));
  }
}

api.interceptors.response.use(
  (res) => {
    const ct = String(res.headers?.["content-type"] || "");
    const url = String(res.config?.url || "");
    if (url.includes("/api/") && ct.includes("text/html")) {
      return Promise.reject(
        Object.assign(new Error("API misconfigured: received HTML instead of JSON. Clear site data or check API URL (should be port 4000)."), {
          response: res,
        })
      );
    }
    return res;
  },
  (err) => {
    const url = err?.config?.url || '';
    const status = err?.response?.status || 0;
    const body = err?.response?.data;
    const errText = String(body?.detail || body?.error || body?.message || err?.message || '').slice(0, 200);
    // After the first logout, suppress duplicate 401 noise from in-flight parallel requests.
    if (status === 401 && authErrorHandled) {
      return Promise.reject(err);
    }
    if (status === 401) {
      const isSilent =
        url.includes('/auth/login') ||
        url.includes('/auth/login-2fa') ||
        url.includes('/auth/onboarding/') ||
        url.includes('/auth/realtime-token') ||
        url.includes('/auth/forgot-password') ||
        url.includes('/auth/me') ||
        url.includes('/live/stream');
      const withinLoginGrace = Date.now() - lastLoginSuccessAt < 8000;
      if (!isSilent && !withinLoginGrace) {
        handleAuthError();
      }
    }
    return Promise.reject(err);
  }
);

export function resetAdminAuthErrorFlag() {
  authErrorHandled = false;
}

function withReauthHeader(reauthToken) {
  return reauthToken
    ? { headers: { "x-admin-reauth-token": reauthToken } }
    : {};
}

function newIdempotencyKey() {
  return (typeof crypto !== "undefined" && crypto.randomUUID?.()) || `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function withIdempotencyKey() {
  return { headers: { "x-idempotency-key": newIdempotencyKey() } };
}

export const adminApi = {
  login: (payload) => api.post("/api/admin/auth/login", payload).then((r) => r.data),
  login2fa: (payload) => api.post("/api/admin/auth/login-2fa", payload).then((r) => r.data),
  onboardingChangePassword: (payload) => api.post("/api/admin/auth/onboarding/change-password", payload).then((r) => r.data),
  onboarding2faSetup: (payload) => api.post("/api/admin/auth/onboarding/2fa/setup", payload).then((r) => r.data),
  onboarding2faRefresh: (payload) => api.post("/api/admin/auth/onboarding/2fa/refresh", payload).then((r) => r.data),
  onboarding2faCheck: (payload) => api.post("/api/admin/auth/onboarding/2fa/check", payload).then((r) => r.data),
  onboarding2faEnable: (payload) => api.post("/api/admin/auth/onboarding/2fa/enable", payload).then((r) => r.data),
  reauth: (payload) => api.post("/api/admin/auth/reauth", payload).then((r) => r.data),
  forgotPasswordStart: (payload) => api.post("/api/admin/auth/forgot-password/start", payload).then((r) => r.data),
  forgotPasswordReset: (payload) => api.post("/api/admin/auth/forgot-password/reset", payload).then((r) => r.data),
  me: () => api.get("/api/admin/auth/me").then((r) => r.data),
  realtimeToken: () => api.get("/api/admin/auth/realtime-token").then((r) => r.data),
  twoFaStatus: () => api.get("/api/admin/auth/2fa/status").then((r) => r.data),
  twoFaSetup: (payload) => api.post("/api/admin/auth/2fa/setup", payload || {}).then((r) => r.data),
  twoFaEnable: (payload) => api.post("/api/admin/auth/2fa/enable", payload).then((r) => r.data),
  twoFaDisable: (payload) => api.post("/api/admin/auth/2fa/disable", payload).then((r) => r.data),
  ssoStatus: () => api.get("/api/admin/auth/sso/status").then((r) => r.data),
  ssoExchange: (payload) => api.post("/api/admin/auth/sso/exchange", payload).then((r) => r.data),

  overview: () => api.get("/api/admin/overview").then((r) => r.data),
  activity: (params) => api.get("/api/admin/activity", { params: params || {} }).then((r) => r.data),
  salesAnalytics: (params) => api.get("/api/admin/analytics/sales", { params: params || {} }).then((r) => r.data),
  customerGrowth: (params) => api.get("/api/admin/analytics/customer-growth", { params: params || {} }).then((r) => r.data),
  topProducts: (params) => api.get("/api/admin/analytics/top-products", { params: params || {} }).then((r) => r.data),
  revenueBreakdown: () => api.get("/api/admin/analytics/revenue-breakdown").then((r) => r.data),
  orderFunnel: () => api.get("/api/admin/analytics/order-funnel").then((r) => r.data),
  liveSnapshot: () => api.get("/api/admin/analytics/live-snapshot").then((r) => r.data),
  categoryRevenue: () => api.get("/api/admin/analytics/category-revenue").then((r) => r.data),
  analyticsCustomers: () => api.get("/api/admin/analytics/customers").then((r) => r.data),

  products: (params) => api.get("/api/admin/products", { params: params || {} }).then((r) => r.data),
  createProduct: (payload) => api.post("/api/admin/products", payload).then((r) => r.data),
  updateProduct: (id, payload) => api.put(`/api/admin/products/${id}`, payload).then((r) => r.data),
  deleteProduct: (id) => api.delete(`/api/admin/products/${id}`).then((r) => r.data),
  duplicateProduct: (id) => api.post(`/api/admin/products/${id}/duplicate`).then((r) => r.data),
  uploadMedia: (file, folder) => {
    const formData = new FormData();
    formData.append("file", file);
    if (folder) formData.append("folder", folder);
    return api
      .post("/api/admin/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      })
      .then((r) => r.data);
  },
  uploadProductMedia: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post("/api/admin/products/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      .then((r) => r.data);
  },
  categories: () => api.get("/api/admin/categories").then((r) => r.data),
  categoryTree: () => api.get("/api/admin/categories/tree").then((r) => r.data),
  catalogTree: () => api.get("/api/admin/catalog-tree").then((r) => r.data),
  categoryNode: (id) => api.get(`/api/admin/categories/${id}`).then((r) => r.data),
  categoryBreadcrumb: (id) => api.get(`/api/admin/categories/${id}/breadcrumb`).then((r) => r.data),
  folderContents: (id, page = 1, size = 50) =>
    api.get(`/api/admin/categories/${id}/contents`, { params: { page, size } }).then((r) => {
      const data = r.data || {};
      const products = Array.isArray(data.products)
        ? data.products.map((p) => ({
            ...p,
            primaryImage: p.primaryImage || p.productAssets?.[0]?.url || null,
          }))
        : [];
      return { ...data, products };
    }),
  rootContents: () => api.get("/api/admin/categories/root/contents").then((r) => {
    const data = r.data || {};
    const products = Array.isArray(data.products)
      ? data.products.map((p) => ({
          ...p,
          primaryImage: p.primaryImage || p.productAssets?.[0]?.url || null,
        }))
      : [];
    return { ...data, products };
  }),
  createCategory: (payload) => api.post("/api/admin/categories", payload).then((r) => r.data),
  updateCategory: (id, payload) => api.put(`/api/admin/categories/${id}`, payload).then((r) => r.data),
  moveCategory: (id, payload) => api.patch(`/api/admin/categories/${id}/move`, payload).then((r) => r.data),
  deleteCategory: (id, force = false) =>
    api.delete(`/api/admin/categories/${id}`, { params: { force } }).then((r) => r.data),

  productDetail: (id) => api.get(`/api/admin/products/${id}/detail`).then((r) => r.data),
  moveProduct: (id, categoryId) =>
    api.patch(`/api/admin/products/${id}/move`, { categoryId }).then((r) => r.data),

  productAssets: (productId) =>
    api.get(`/api/admin/products/${productId}/assets`).then((r) => {
      const data = r.data;
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.assets)) return data.assets;
      return [];
    }),
  uploadProductAsset: (productId, file, assetType = "image", isPrimary = false) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("assetType", assetType);
    formData.append("isPrimary", String(isPrimary));
    return api.post(`/api/admin/products/${productId}/assets/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    }).then((r) => r.data);
  },
  updateProductAsset: (productId, assetId, payload) =>
    api.put(`/api/admin/products/${productId}/assets/${assetId}`, payload).then((r) => r.data),
  deleteProductAsset: (productId, assetId) =>
    api.delete(`/api/admin/products/${productId}/assets/${assetId}`).then((r) => r.data),
  reorderProductAssets: (productId, items) =>
    api.patch(`/api/admin/products/${productId}/assets/reorder`, items).then((r) => r.data),

  banners: (params) => api.get("/api/admin/banners", { params: params || {} }).then((r) => r.data),
  createBanner: (payload) => api.post("/api/admin/banners", payload).then((r) => r.data),
  updateBanner: (id, payload) => api.put(`/api/admin/banners/${id}`, payload).then((r) => r.data),
  deleteBanner: (id) => api.delete(`/api/admin/banners/${id}`).then((r) => r.data),

  tagGroups: () => api.get("/api/admin/tag-groups").then((r) => r.data),
  createTagGroup: (payload) => api.post("/api/admin/tag-groups", payload).then((r) => r.data),
  updateTagGroup: (id, payload) => api.put(`/api/admin/tag-groups/${id}`, payload).then((r) => r.data),
  deleteTagGroup: (id) => api.delete(`/api/admin/tag-groups/${id}`).then((r) => r.data),
  createTag: (payload) => api.post("/api/admin/tags", payload).then((r) => r.data),
  updateTag: (id, payload) => api.put(`/api/admin/tags/${id}`, payload).then((r) => r.data),
  deleteTag: (id) => api.delete(`/api/admin/tags/${id}`).then((r) => r.data),
  productTags: (productId) => api.get(`/api/admin/products/${productId}/tags`).then((r) => r.data),
  setProductTags: (productId, tagIds) =>
    api.put(`/api/admin/products/${productId}/tags`, { tagIds }).then((r) => r.data),

  trustBadges: () => api.get("/api/admin/trust-badges").then((r) => r.data),
  createTrustBadge: (payload) => api.post("/api/admin/trust-badges", payload).then((r) => r.data),
  updateTrustBadge: (id, payload) => api.put(`/api/admin/trust-badges/${id}`, payload).then((r) => r.data),
  deleteTrustBadge: (id) => api.delete(`/api/admin/trust-badges/${id}`).then((r) => r.data),
  productTrustBadges: (productId) =>
    api.get(`/api/admin/products/${productId}/trust-badges`).then((r) => r.data),
  setProductTrustBadges: (productId, badgeIds) =>
    api.put(`/api/admin/products/${productId}/trust-badges`, { badgeIds }).then((r) => r.data),

  catalogSearch: (q) => api.get("/api/admin/search", { params: { q } }).then((r) => r.data),

  brands: () => api.get("/api/admin/brands").then((r) => r.data),
  brand: (id) => api.get(`/api/admin/brands/${id}`).then((r) => r.data),
  createBrand: (payload) => api.post("/api/admin/brands", payload).then((r) => r.data),
  updateBrand: (id, payload) => api.put(`/api/admin/brands/${id}`, payload).then((r) => r.data),
  deleteBrand: (id) => api.delete(`/api/admin/brands/${id}`).then((r) => r.data),
  searchBrands: (q) => api.get("/api/admin/brands/search", { params: { q } }).then((r) => r.data),

  productPricing: (productId) =>
    api.get(`/api/admin/products/${productId}/pricing`).then((r) => r.data),
  upsertProductPricing: (productId, payload) =>
    api.post(`/api/admin/products/${productId}/pricing`, payload).then((r) => r.data),
  updateProductPricing: (productId, id, payload) =>
    api.put(`/api/admin/products/${productId}/pricing/${id}`, payload).then((r) => r.data),
  deleteProductPricing: (productId, id) =>
    api.delete(`/api/admin/products/${productId}/pricing/${id}`).then((r) => r.data),
  replaceProductPricing: (productId, rows) =>
    api.put(`/api/admin/products/${productId}/pricing/replace`, rows).then((r) => r.data),

  bulkUpload: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/api/admin/products/bulk-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    }).then((r) => r.data);
  },

  customers: () => api.get("/api/admin/customers").then((r) => r.data),
  customer: (id) => api.get(`/api/admin/customers/${id}`).then((r) => r.data),
  customer360: (id) => api.get(`/api/admin/customers/${id}/360`).then((r) => r.data),
  customerOrders: (id) => api.get(`/api/admin/customers/${id}/orders`).then((r) => r.data),
  patchCustomerAccountStatus: (id, payload) =>
    api.patch(`/api/admin/customers/${id}/account-status`, payload).then((r) => r.data),
  updateCustomer: (id, payload) => api.put(`/api/admin/customers/${id}`, payload).then((r) => r.data),
  deleteCustomer: (id, reauthToken) =>
    api.delete(`/api/admin/customers/${id}`, withReauthHeader(reauthToken)).then((r) => r.data),
  approveWholesale: (id) => api.post(`/api/admin/wholesale/${id}/approve`).then((r) => r.data),
  revokeWholesale: (id) => api.post(`/api/admin/wholesale/${id}/revoke`).then((r) => r.data),

  orders: (params) => api.get("/api/admin/orders", { params: params || {} }).then((r) => r.data),
  orderDetail: (id) => api.get(`/api/admin/orders/${id}`).then((r) => r.data),
  updateOrderStatus: (id, statusOrPayload) => {
    const body = typeof statusOrPayload === "string" ? { status: statusOrPayload } : statusOrPayload;
    return api.patch(`/api/admin/orders/${id}/status`, body).then((r) => r.data);
  },
  updateOrderTracking: (id, payload) =>
    api.patch(`/api/admin/orders/${id}/tracking`, payload).then((r) => r.data),
  updatePaymentStatus: (id, paymentOrPayload, reauthToken) => {
    const body =
      typeof paymentOrPayload === "string" ? { paymentStatus: paymentOrPayload } : paymentOrPayload;
    return api.patch(`/api/admin/orders/${id}/payment-status`, body, withReauthHeader(reauthToken)).then((r) => r.data);
  },

  payments: (params) => api.get("/api/admin/payments", { params: params || {} }).then((r) => r.data),
  paymentReconciliationMismatches: () =>
    api.get("/api/admin/payments/reconciliation/mismatches").then((r) => r.data),
  paymentDetail: (id) => api.get(`/api/admin/payments/${id}`).then((r) => r.data),
  patchPaymentTransaction: (id, payload) => api.patch(`/api/admin/payments/${id}`, payload).then((r) => r.data),
  teamMembers: () => api.get("/api/admin/team/members").then((r) => r.data),
  teamMemberSessions: (id) => api.get(`/api/admin/team/members/${id}/sessions`).then((r) => r.data),
  revokeTeamMemberSessions: (id) => api.post(`/api/admin/team/members/${id}/sessions/revoke-all`).then((r) => r.data),
  addMember: (payload) => api.post("/api/admin/team/members", payload).then((r) => r.data),
  updateMember: (id, payload) => api.put(`/api/admin/team/members/${id}`, payload).then((r) => r.data),
  resetMemberPassword: (id, payload, reauthToken) =>
    api.put(`/api/admin/team/members/${id}/password`, payload, withReauthHeader(reauthToken)).then((r) => r.data),
  requestMember2faReset: (id, reauthToken) =>
    api.post(`/api/admin/team/members/${id}/request-2fa-reset`, {}, withReauthHeader(reauthToken)).then((r) => r.data),
  deleteMember: (id, reauthToken) =>
    api.delete(`/api/admin/team/members/${id}`, withReauthHeader(reauthToken)).then((r) => r.data),

  notifications: (params) =>
    api.get("/api/admin/notifications", { params: params || {} }).then((r) => r.data),
  notificationsUnreadCount: () => api.get("/api/admin/notifications/unread-count").then((r) => r.data),
  markNotificationRead: (id) => api.patch(`/api/admin/notifications/${id}/read`).then((r) => r.data),
  markAllAdminNotificationsRead: () => api.post("/api/admin/notifications/read-all").then((r) => r.data),
  createNotification: (payload, reauthToken) =>
    api.post("/api/admin/notifications", payload, withReauthHeader(reauthToken)).then((r) => r.data),
  broadcastCustomerNotifications: (payload, reauthToken) =>
    api.post("/api/admin/notifications/broadcast-customers", payload, withReauthHeader(reauthToken)).then((r) => r.data),

  disputes: () => api.get("/api/admin/disputes").then((r) => r.data),
  createDispute: (payload) => api.post("/api/admin/disputes", payload).then((r) => r.data),
  updateDispute: (id, payload) => api.patch(`/api/admin/disputes/${id}`, payload).then((r) => r.data),
  deleteDispute: (id) => api.delete(`/api/admin/disputes/${id}`).then((r) => r.data),

  deleteNotification: (id) => api.delete(`/api/admin/notifications/${id}`).then((r) => r.data),

  auditLogs: (params) => api.get("/api/admin/audit-logs", { params: params || {} }).then((r) => r.data),

  chatSessions: (params) => api.get("/api/admin/chat/sessions", { params: params || {} }).then((r) => r.data),
  chatSessionsAll: (params) => api.get("/api/admin/chat/sessions/all", { params: params || {} }).then((r) => r.data),
  chatSession: (id) => api.get(`/api/admin/chat/sessions/${id}`).then((r) => r.data),
  chatClaim: (id) => api.post(`/api/admin/chat/sessions/${id}/claim`).then((r) => r.data),
  chatSendMessage: (id, payload) => api.post(`/api/admin/chat/sessions/${id}/messages`, payload).then((r) => r.data),
  chatFinish: (id) => api.post(`/api/admin/chat/sessions/${id}/finish`).then((r) => r.data),
  chatNotResolved: (id) => api.post(`/api/admin/chat/sessions/${id}/not-resolved`).then((r) => r.data),
  chatTyping: (id) => api.post(`/api/admin/chat/sessions/${id}/typing`).then((r) => r.data),
  chatMarkRead: (id) => api.post(`/api/admin/chat/sessions/${id}/read`).then((r) => r.data),
  chatGetGreeting: () => api.get("/api/admin/chat/greeting").then((r) => r.data),
  chatSetGreeting: (greeting) => api.put("/api/admin/chat/greeting", { greeting }).then((r) => r.data),
  chatGetQuickReplies: () => api.get("/api/admin/chat/quick-replies").then((r) => r.data),
  chatSetQuickReplies: (replies) => api.put("/api/admin/chat/quick-replies", { replies }).then((r) => r.data),

  wholesaleApplications: () => api.get("/api/admin/applications/wholesale").then((r) => r.data),
  businessInquiries: () => api.get("/api/admin/applications/business-inquiries").then((r) => r.data),
  updateWholesaleApplication: (id, payload) =>
    api.patch(`/api/admin/applications/wholesale/${id}`, payload).then((r) => r.data),
  updatePartnerRequest: (id, payload) =>
    api.patch(`/api/admin/applications/partner-requests/${id}`, payload).then((r) => r.data),

  globalSettings: () => api.get("/api/admin/global-settings").then((r) => r.data),
  updateGlobalSettings: (payload) => api.put("/api/admin/global-settings", payload).then((r) => r.data),
  testSslcommerz: () => api.post("/api/admin/global-settings/sslcommerz/test").then((r) => r.data),

  // ─── Microsoft 365 email ───────────────────────────────────────────────
  emailStatus: () => api.get("/api/admin/email/status").then((r) => r.data),
  emailSyncThemePhotos: () => api.post("/api/admin/email/sync-theme-photos").then((r) => r.data),
  emailLogs: (params) => api.get("/api/admin/email/logs", { params: params || {} }).then((r) => r.data),
  emailInbox: (params) => api.get("/api/admin/email/inbox", { params: params || {} }).then((r) => r.data),
  emailMessage: (id, params) => api.get(`/api/admin/email/message/${id}`, { params: params || {} }).then((r) => r.data),
  emailSend: (payload) => api.post("/api/admin/email/send", payload).then((r) => r.data),
  emailReply: (id, payload) => api.post(`/api/admin/email/reply/${id}`, payload).then((r) => r.data),
  emailFolders: (params) => api.get("/api/admin/email/folders", { params: params || {} }).then((r) => r.data),
  emailMove: (id, payload) => api.post(`/api/admin/email/message/${id}/move`, payload).then((r) => r.data),
  emailMarkRead: (id, payload) => api.patch(`/api/admin/email/message/${id}/read`, payload).then((r) => r.data),
  emailAttachments: (id, params) => api.get(`/api/admin/email/message/${id}/attachments`, { params: params || {} }).then((r) => r.data),
  emailDrafts: () => api.get("/api/admin/email/drafts").then((r) => r.data),
  emailSaveDraft: (payload) => api.post("/api/admin/email/draft", payload).then((r) => r.data),
  emailTemplates: (params) => api.get("/api/admin/email-templates", { params: params || {} }).then((r) => r.data),
  emailTemplateCreate: (payload) => api.post("/api/admin/email-templates", payload).then((r) => r.data),
  emailTemplateUpdate: (id, payload) => api.put(`/api/admin/email-templates/${id}`, payload).then((r) => r.data),
  emailTemplateDelete: (id) => api.delete(`/api/admin/email-templates/${id}`).then((r) => r.data),

  metaStatus: () => api.get("/api/admin/meta/status").then((r) => r.data),
  metaConnect: (payload) => api.post("/api/admin/meta/connect", payload).then((r) => r.data),
  metaCatalogSync: () => api.post("/api/admin/meta/catalog/sync").then((r) => r.data),
  metaPosts: () => api.get("/api/admin/meta/posts").then((r) => r.data),
  metaCreatePost: (payload) => api.post("/api/admin/meta/posts", payload).then((r) => r.data),
  metaPublishPost: (id) => api.post(`/api/admin/meta/posts/${id}/publish`).then((r) => r.data),
  metaCampaigns: () => api.get("/api/admin/meta/campaigns").then((r) => r.data),
  metaCreateCampaign: (payload) => api.post("/api/admin/meta/campaigns", payload).then((r) => r.data),
  metaOAuthUrl: () => api.get("/api/admin/meta/oauth/url").then((r) => r.data),
  metaOAuthCallback: (payload) => api.post("/api/admin/meta/oauth/callback", payload).then((r) => r.data),

  communicationsTimeline: (customerId) => api.get(`/api/admin/communications/timeline/${customerId}`).then((r) => r.data),
  communicationsSearch: (params) => api.get("/api/admin/communications/timeline/search", { params: params || {} }).then((r) => r.data),

  integrationsStatus: () => api.get("/api/admin/integrations/status").then((r) => r.data),
  googleAnalyticsInsights: (params) => api.get("/api/admin/integrations/google/analytics", { params: params || {} }).then((r) => r.data),
  googleMerchantSync: () => api.post("/api/admin/integrations/google/merchant/sync").then((r) => r.data),
  microsoftDirectory: () => api.get("/api/admin/integrations/microsoft/directory").then((r) => r.data),
  microsoftCalendarCreate: (payload) => api.post("/api/admin/integrations/microsoft/calendar/events", payload).then((r) => r.data),
  microsoftDriveUpload: (payload) => api.post("/api/admin/integrations/microsoft/drive/upload", payload).then((r) => r.data),

  // ─── SEO automation ────────────────────────────────────────────────────
  seoOverview: () => api.get("/api/admin/seo/overview").then((r) => r.data),
  seoList: (params) => api.get("/api/admin/seo/metadata", { params: params || {} }).then((r) => r.data),
  seoGet: (entityType, entityId, params) => api.get(`/api/admin/seo/metadata/${entityType}/${entityId}`, { params: params || {} }).then((r) => r.data),
  seoUpsert: (payload) => api.post("/api/admin/seo/metadata", payload).then((r) => r.data),
  seoGenerate: (payload) => api.post("/api/admin/seo/generate", payload).then((r) => r.data),
  seoBulkGenerate: (payload) => api.post("/api/admin/seo/bulk-generate", payload).then((r) => r.data),
  seoSitemapPing: () => api.post("/api/admin/seo/sitemap/ping").then((r) => r.data),

  // ─── CRM intelligence + predictive analytics ───────────────────────────
  intelOverview: () => api.get("/api/admin/intelligence/overview").then((r) => r.data),
  intelChurn: (params) => api.get("/api/admin/intelligence/churn", { params: params || {} }).then((r) => r.data),
  intelSegments: () => api.get("/api/admin/intelligence/segments").then((r) => r.data),
  intelClv: (params) => api.get("/api/admin/intelligence/clv", { params: params || {} }).then((r) => r.data),
  intelCohorts: () => api.get("/api/admin/intelligence/cohorts").then((r) => r.data),
  intelForecast: (params) => api.get("/api/admin/intelligence/forecast", { params: params || {} }).then((r) => r.data),
  intelAbandonedCarts: () => api.get("/api/admin/intelligence/abandoned-carts").then((r) => r.data),
  intelRestock: () => api.get("/api/admin/intelligence/restock").then((r) => r.data),
  intelInsights: () => api.get("/api/admin/intelligence/insights").then((r) => r.data),
  intelCustomerTimeline: (id) => api.get(`/api/admin/intelligence/customers/${id}/timeline`).then((r) => r.data),
  intelRecompute: (payload) => api.post("/api/admin/intelligence/recompute", payload || {}).then((r) => r.data),
  // Sales pipeline CRM
  pipelines: () => api.get("/api/admin/intelligence/pipelines").then((r) => r.data),
  createPipeline: (payload) => api.post("/api/admin/intelligence/pipelines", payload).then((r) => r.data),
  deals: (params) => api.get("/api/admin/intelligence/deals", { params: params || {} }).then((r) => r.data),
  createDeal: (payload) => api.post("/api/admin/intelligence/deals", payload).then((r) => r.data),
  updateDeal: (id, payload) => api.patch(`/api/admin/intelligence/deals/${id}`, payload).then((r) => r.data),
  deleteDeal: (id) => api.delete(`/api/admin/intelligence/deals/${id}`).then((r) => r.data),

  // ─── AI marketing automation ───────────────────────────────────────────
  campaigns: (params) => api.get("/api/admin/marketing/campaigns", { params: params || {} }).then((r) => r.data),
  campaign: (id) => api.get(`/api/admin/marketing/campaigns/${id}`).then((r) => r.data),
  createCampaign: (payload) => api.post("/api/admin/marketing/campaigns", payload).then((r) => r.data),
  updateCampaign: (id, payload) => api.patch(`/api/admin/marketing/campaigns/${id}`, payload).then((r) => r.data),
  deleteCampaign: (id) => api.delete(`/api/admin/marketing/campaigns/${id}`).then((r) => r.data),
  campaignAudiencePreview: (payload) => api.post("/api/admin/marketing/audience/preview", payload).then((r) => r.data),
  campaignEnroll: (id, payload) => api.post(`/api/admin/marketing/campaigns/${id}/enroll`, payload || {}).then((r) => r.data),
  marketingGenerate: (payload) => api.post("/api/admin/marketing/generate", payload).then((r) => r.data),

  liveSnapshotAdmin: () => api.get("/api/admin/live/snapshot").then((r) => r.data),
  liveStreamUrl: (token) =>
    `${resolveAdminApiBase()}/api/admin/live/stream?token=${encodeURIComponent(token || "")}`,

  tickets: (params) => api.get("/api/admin/tickets", { params: params || {} }).then((r) => r.data),
  ticketDetail: (id) => api.get(`/api/admin/tickets/${id}`).then((r) => r.data),
  replyTicket: (id, payload) => api.post(`/api/admin/tickets/${id}/reply`, payload).then((r) => r.data),
  updateTicket: (id, payload) => api.put(`/api/admin/tickets/${id}`, payload).then((r) => r.data),
  markTicketSeen: (id) => api.post(`/api/admin/tickets/${id}/seen`).then((r) => r.data),
  createAdminTicket: (payload) => api.post("/api/admin/tickets", payload).then((r) => r.data),
  clientErrors: (params) => api.get("/api/admin/client-errors", { params: params || {} }).then((r) => r.data),
  clientErrorDetail: (id) => api.get(`/api/admin/client-errors/${id}`).then((r) => r.data),
  markClientErrorReviewed: (id) => api.post(`/api/admin/client-errors/${id}/reviewed`).then((r) => r.data),
  uploadTicketFile: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/api/admin/tickets/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    }).then((r) => r.data);
  },

  coupons: (params) => api.get("/api/admin/coupons", { params: params || {} }).then((r) => r.data),
  createCoupon: (payload) => api.post("/api/admin/coupons", payload).then((r) => r.data),
  updateCoupon: (id, payload) => api.put(`/api/admin/coupons/${id}`, payload).then((r) => r.data),
  deleteCoupon: (id) => api.delete(`/api/admin/coupons/${id}`).then((r) => r.data),

  returns: (params) => api.get("/api/admin/returns", { params: params || {} }).then((r) => r.data),
  returnDetail: (id) => api.get(`/api/admin/returns/${id}`).then((r) => r.data),
  updateReturn: (id, payload) => api.patch(`/api/admin/returns/${id}`, payload).then((r) => r.data),
  refundReturn: (id, payload, reauthToken) =>
    api.post(`/api/admin/returns/${id}/refund`, payload, withReauthHeader(reauthToken)).then((r) => r.data),

  inventory: (params) => api.get("/api/admin/inventory", { params: params || {} }).then((r) => r.data),
  inventoryDetail: (id) => api.get(`/api/admin/inventory/${id}`).then((r) => r.data),
  updateInventory: (id, payload) => api.put(`/api/admin/inventory/${id}`, payload).then((r) => r.data),
  adjustInventory: (id, payload) => api.post(`/api/admin/inventory/${id}/adjust`, payload).then((r) => r.data),
  lowStockItems: () => api.get("/api/admin/inventory/low-stock").then((r) => r.data),

  // Fulfillment / Delivery
  shipments: (params) => api.get("/api/admin/fulfillment/shipments", { params: params || {} }).then((r) => r.data),
  shipment: (id) => api.get(`/api/admin/fulfillment/shipments/${id}`).then((r) => r.data),
  shipmentsByOrder: (orderId) => api.get(`/api/admin/fulfillment/shipments/order/${orderId}`).then((r) => r.data),
  createShipment: (payload) => api.post("/api/admin/fulfillment/shipments", payload).then((r) => r.data),
  updateShipmentStatus: (id, payload) => api.patch(`/api/admin/fulfillment/shipments/${id}/status`, payload).then((r) => r.data),
  updateShipmentTracking: (id, payload) => api.put(`/api/admin/fulfillment/shipments/${id}/tracking`, payload).then((r) => r.data),
  deleteShipment: (id) => api.delete(`/api/admin/fulfillment/shipments/${id}`).then((r) => r.data),

  // Courier Delivery Management
  deliveries: (params) => api.get("/api/admin/delivery", { params: params || {} }).then((r) => r.data),
  deliveryDetail: (id) => api.get(`/api/admin/delivery/${id}`).then((r) => r.data),
  assignCourier: (payload) => api.post("/api/admin/delivery/assign", payload, withIdempotencyKey()).then((r) => r.data),
  manualTracking: (payload) => api.post("/api/admin/delivery/manual", payload).then((r) => r.data),
  trackDelivery: (orderId) => api.get(`/api/admin/delivery/track/${orderId}`).then((r) => r.data),
  cancelDelivery: (orderId) => api.post(`/api/admin/delivery/cancel/${orderId}`, {}, withIdempotencyKey()).then((r) => r.data),
  availableCouriers: () => api.get("/api/admin/delivery/couriers").then((r) => r.data),
  deliveryHealthSummary: () => api.get("/api/admin/delivery/health/summary").then((r) => r.data),
  deliveryPriceEstimate: (payload) => api.post("/api/admin/delivery/price-estimate", payload).then((r) => r.data),
  pathaoCities: () => api.get("/api/admin/delivery/pathao/cities").then((r) => r.data),
  pathaoZones: (cityId) => api.get(`/api/admin/delivery/pathao/zones/${cityId}`).then((r) => r.data),
  pathaoAreas: (zoneId) => api.get(`/api/admin/delivery/pathao/areas/${zoneId}`).then((r) => r.data),
  pathaoStores: () => api.get("/api/admin/delivery/pathao/stores").then((r) => r.data),
  steadfastBalance: () => api.get("/api/admin/delivery/steadfast/balance").then((r) => r.data),

  // Payments extras
  markPaymentPaid: (id) => api.post(`/api/admin/payments/${id}/mark-paid`).then((r) => r.data),
  requestPaymentAgain: (id, payload) =>
    api.post(`/api/admin/payments/${id}/request-repay`, payload || {}).then((r) => r.data),
  refundPayment: (id, payload, reauthToken) =>
    api.post(`/api/admin/payments/${id}/refund`, payload, {
      ...withReauthHeader(reauthToken),
      headers: { ...withReauthHeader(reauthToken).headers, ...withIdempotencyKey().headers },
    }).then((r) => r.data),
  orderInvoice: (orderId) => api.get(`/api/admin/payments/invoice/${orderId}`).then((r) => r.data),

  // Disputes extras
  disputeDetail: (id) => api.get(`/api/admin/disputes/${id}`).then((r) => r.data),
  escalateDispute: (id) => api.post(`/api/admin/disputes/${id}/escalate`).then((r) => r.data),

  // Engagement / subscriptions / Q&A moderation
  qaList: (status) => api.get("/api/admin/qa", { params: { status } }).then((r) => r.data),
  qaPending: () => api.get("/api/admin/qa/pending").then((r) => r.data),
  moderateQa: (id, payload) => api.patch(`/api/admin/qa/${id}`, payload).then((r) => r.data),
  newsletterSubscribers: () => api.get("/api/admin/newsletter/subscribers").then((r) => r.data),
  stockAlertSubscribers: () => api.get("/api/admin/stock-alerts/subscribers").then((r) => r.data),

  // Seller applications
  sellerApplications: (params) => api.get("/api/admin/applications/sellers", { params: params || {} }).then((r) => r.data),
  updateSellerApplication: (id, payload) => api.patch(`/api/admin/applications/sellers/${id}`, payload).then((r) => r.data),

  // Cloudinary Media
  mediaUpload: (file, folder, tags) => {
    const fd = new FormData();
    fd.append("file", file);
    if (folder) fd.append("folder", folder);
    if (tags) fd.append("tags", tags);
    return api.post("/api/admin/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  mediaUploadMultiple: (files, folder, tags) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (folder) fd.append("folder", folder);
    if (tags) fd.append("tags", tags);
    return api.post("/api/admin/media/upload-multiple", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  mediaList: (params) => api.get("/api/admin/media/list", { params: params || {} }).then((r) => r.data),
  mediaDelete: (publicId, resourceType) => api.delete("/api/admin/media/delete", { params: { publicId, resourceType } }).then((r) => r.data),
  mediaTransformUrl: (payload) => api.post("/api/admin/media/transform-url", payload).then((r) => r.data),
  mediaRename: (fromPublicId, toPublicId) => api.post("/api/admin/media/rename", { fromPublicId, toPublicId }).then((r) => r.data),

  productVariants: (productId) => api.get(`/api/admin/products/${productId}/variants`).then((r) => r.data),
  createProductVariant: (productId, payload) =>
    api.post(`/api/admin/products/${productId}/variants`, payload).then((r) => r.data?.variant ?? r.data),
  updateProductVariant: (productId, variantId, payload) =>
    api.put(`/api/admin/products/${productId}/variants/${variantId}`, payload).then((r) => r.data?.variant ?? r.data),
  deleteProductVariant: (productId, variantId) => api.delete(`/api/admin/products/${productId}/variants/${variantId}`).then((r) => r.data),

  productCategoryMap: (productId) => api.get(`/api/admin/products/${productId}/categories`).then((r) => r.data),
  setProductCategories: (productId, categoryIds) =>
    api.put(`/api/admin/products/${productId}/categories`, { categoryIds }).then((r) => r.data),

  trackProductClick: (productId) => api.post(`/api/admin/products/${productId}/track-click`).then((r) => r.data),
  productMetrics: (productId) => api.get(`/api/admin/products/${productId}/metrics`).then((r) => r.data),

  homepageCategories: () => api.get("/api/admin/homepage/categories").then((r) => r.data),
  setHomepageCategories: (payload) => api.post("/api/admin/homepage/categories", payload).then((r) => r.data),

  brandsInCategory: (categoryId) =>
    api.get(`/api/admin/categories/${categoryId}/brands`).then((r) => {
      const raw = r.data?.brands;
      if (!Array.isArray(raw)) return [];
      return raw.map((b) => {
        if (typeof b === "string") {
          return { id: b, nameEn: b, logoUrl: null, productCount: 0 };
        }
        return {
          id: b.id || b.nameEn || b.name || "",
          nameEn: b.nameEn || b.name || b.id || "Unknown Brand",
          logoUrl: b.logoUrl || null,
          productCount: Number(b.productCount || 0),
        };
      }).filter((b) => b.id && b.nameEn);
    }),
  productsByBrandInCategory: (categoryId, brandId, page = 1, size = 50) =>
    api.get(`/api/admin/categories/${categoryId}/brands/${brandId}/products`, { params: { page, size } }).then((r) => {
      const data = r.data || {};
      const products = Array.isArray(data.products)
        ? data.products.map((p) => ({
            ...p,
            primaryImage: p.primaryImage || p.productAssets?.[0]?.url || null,
          }))
        : [];
      return { ...data, products };
    }),
};

export async function safeApiCall(promise) {
  try {
    const response = await promise;
    return { data: response.data, error: null };
  } catch (error) {
    if (error.response && error.response.status === 401) {
      handleAuthError();
    }
    return { data: null, error: error.response?.data?.detail || error.message || "API request failed" };
  }
}
