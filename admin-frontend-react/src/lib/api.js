import axios from "axios";
import { clearSession, getToken } from "./auth";

export function resolveAdminApiBase() {
  const fromLs = typeof localStorage !== "undefined" ? localStorage.getItem("oceanbazar_admin_api") : null;
  return (fromLs || import.meta.env.VITE_ADMIN_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

export const api = axios.create({
  baseURL: resolveAdminApiBase(),
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
  config.baseURL = resolveAdminApiBase();
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    console.log('API Response:', res.status, res.config.url);
    return res;
  },
  (err) => {
    console.error('API Error:', err.message, err.config?.url, err.response?.status);
    if (err?.response?.status === 401) {
      // Don't redirect on login attempts — let the LoginPage handle the error
      const url = err.config?.url || '';
      if (!url.includes('/auth/login')) {
        clearSession();
        window.location.reload();
      }
    }
    return Promise.reject(err);
  }
);

export const adminApi = {
  login: (payload) => api.post("/api/admin/auth/login", payload).then((r) => r.data),
  me: () => api.get("/api/admin/auth/me").then((r) => r.data),

  overview: () => api.get("/api/admin/overview").then((r) => r.data),
  salesAnalytics: (params) => api.get("/api/admin/analytics/sales", { params: params || {} }).then((r) => r.data),
  customerGrowth: (params) => api.get("/api/admin/analytics/customer-growth", { params: params || {} }).then((r) => r.data),
  topProducts: (params) => api.get("/api/admin/analytics/top-products", { params: params || {} }).then((r) => r.data),
  revenueBreakdown: () => api.get("/api/admin/analytics/revenue-breakdown").then((r) => r.data),
  orderFunnel: () => api.get("/api/admin/analytics/order-funnel").then((r) => r.data),
  liveSnapshot: () => api.get("/api/admin/analytics/live-snapshot").then((r) => r.data),

  products: () => api.get("/api/admin/products").then((r) => r.data),
  createProduct: (payload) => api.post("/api/admin/products", payload).then((r) => r.data),
  updateProduct: (id, payload) => api.put(`/api/admin/products/${id}`, payload).then((r) => r.data),
  deleteProduct: (id) => api.delete(`/api/admin/products/${id}`).then((r) => r.data),
  uploadMedia: (file, folder) => {
    const formData = new FormData();
    formData.append("file", file);
    if (folder) formData.append("folder", folder);
    return api
      .post("/api/admin/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
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
  categoryNode: (id) => api.get(`/api/admin/categories/${id}`).then((r) => r.data),
  categoryBreadcrumb: (id) => api.get(`/api/admin/categories/${id}/breadcrumb`).then((r) => r.data),
  folderContents: (id, page = 1, size = 50) =>
    api.get(`/api/admin/categories/${id}/contents`, { params: { page, size } }).then((r) => r.data),
  rootContents: () => api.get("/api/admin/categories/root/contents").then((r) => r.data),
  createCategory: (payload) => api.post("/api/admin/categories", payload).then((r) => r.data),
  updateCategory: (id, payload) => api.put(`/api/admin/categories/${id}`, payload).then((r) => r.data),
  moveCategory: (id, payload) => api.patch(`/api/admin/categories/${id}/move`, payload).then((r) => r.data),
  deleteCategory: (id, force = false) =>
    api.delete(`/api/admin/categories/${id}`, { params: { force } }).then((r) => r.data),

  productDetail: (id) => api.get(`/api/admin/products/${id}/detail`).then((r) => r.data),
  moveProduct: (id, categoryId) =>
    api.patch(`/api/admin/products/${id}/move`, { categoryId }).then((r) => r.data),

  productAssets: (productId) => api.get(`/api/admin/products/${productId}/assets`).then((r) => r.data),
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
  customerOrders: (id) => api.get(`/api/admin/customers/${id}/orders`).then((r) => r.data),
  patchCustomerAccountStatus: (id, payload) =>
    api.patch(`/api/admin/customers/${id}/account-status`, payload).then((r) => r.data),
  updateCustomer: (id, payload) => api.put(`/api/admin/customers/${id}`, payload).then((r) => r.data),
  deleteCustomer: (id) => api.delete(`/api/admin/customers/${id}`).then((r) => r.data),
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
  updatePaymentStatus: (id, paymentOrPayload) => {
    const body =
      typeof paymentOrPayload === "string" ? { paymentStatus: paymentOrPayload } : paymentOrPayload;
    return api.patch(`/api/admin/orders/${id}/payment-status`, body).then((r) => r.data);
  },

  payments: (params) => api.get("/api/admin/payments", { params: params || {} }).then((r) => r.data),
  paymentDetail: (id) => api.get(`/api/admin/payments/${id}`).then((r) => r.data),
  patchPaymentTransaction: (id, payload) => api.patch(`/api/admin/payments/${id}`, payload).then((r) => r.data),
  teamMembers: () => api.get("/api/admin/team/members").then((r) => r.data),
  addMember: (payload) => api.post("/api/admin/team/members", payload).then((r) => r.data),
  updateMember: (id, payload) => api.put(`/api/admin/team/members/${id}`, payload).then((r) => r.data),
  resetMemberPassword: (id, payload) => api.put(`/api/admin/team/members/${id}/password`, payload).then((r) => r.data),
  deleteMember: (id) => api.delete(`/api/admin/team/members/${id}`).then((r) => r.data),

  notifications: (params) =>
    api.get("/api/admin/notifications", { params: params || {} }).then((r) => r.data),
  notificationsUnreadCount: () => api.get("/api/admin/notifications/unread-count").then((r) => r.data),
  markNotificationRead: (id) => api.patch(`/api/admin/notifications/${id}/read`).then((r) => r.data),
  markAllAdminNotificationsRead: () => api.post("/api/admin/notifications/read-all").then((r) => r.data),
  createNotification: (payload) => api.post("/api/admin/notifications", payload).then((r) => r.data),
  broadcastCustomerNotifications: (payload) =>
    api.post("/api/admin/notifications/broadcast-customers", payload).then((r) => r.data),

  disputes: () => api.get("/api/admin/disputes").then((r) => r.data),
  createDispute: (payload) => api.post("/api/admin/disputes", payload).then((r) => r.data),
  updateDispute: (id, payload) => api.patch(`/api/admin/disputes/${id}`, payload).then((r) => r.data),
  deleteDispute: (id) => api.delete(`/api/admin/disputes/${id}`).then((r) => r.data),

  deleteNotification: (id) => api.delete(`/api/admin/notifications/${id}`).then((r) => r.data),

  auditLogs: (params) => api.get("/api/admin/audit-logs", { params: params || {} }).then((r) => r.data),

  conversations: () => api.get("/api/admin/chat/conversations").then((r) => r.data),
  conversationDetail: (sessionId) =>
    api.get(`/api/admin/chat/conversations/${sessionId}`).then((r) => r.data),
  replyConversation: (sessionId, payload) =>
    api.post(`/api/admin/chat/conversations/${sessionId}/reply`, payload).then((r) => r.data),
  closeConversation: (sessionId) =>
    api.post(`/api/admin/chat/conversations/${sessionId}/close`).then((r) => r.data),

  wholesaleApplications: () => api.get("/api/admin/applications/wholesale").then((r) => r.data),
  businessInquiries: () => api.get("/api/admin/applications/business-inquiries").then((r) => r.data),
  updateWholesaleApplication: (id, payload) =>
    api.patch(`/api/admin/applications/wholesale/${id}`, payload).then((r) => r.data),
  updatePartnerRequest: (id, payload) =>
    api.patch(`/api/admin/applications/partner-requests/${id}`, payload).then((r) => r.data),

  globalSettings: () => api.get("/api/admin/global-settings").then((r) => r.data),
  updateGlobalSettings: (payload) => api.put("/api/admin/global-settings", payload).then((r) => r.data),

  liveSnapshotAdmin: () => api.get("/api/admin/live/snapshot").then((r) => r.data),
  liveStreamUrl: (token) =>
    `${resolveAdminApiBase()}/api/admin/live/stream?token=${encodeURIComponent(token || "")}`,

  tickets: (params) => api.get("/api/admin/tickets", { params: params || {} }).then((r) => r.data),
  ticketDetail: (id) => api.get(`/api/admin/tickets/${id}`).then((r) => r.data),
  replyTicket: (id, payload) => api.post(`/api/admin/tickets/${id}/reply`, payload).then((r) => r.data),
  updateTicket: (id, payload) => api.put(`/api/admin/tickets/${id}`, payload).then((r) => r.data),
  markTicketSeen: (id) => api.post(`/api/admin/tickets/${id}/seen`).then((r) => r.data),
  createAdminTicket: (payload) => api.post("/api/admin/tickets", payload).then((r) => r.data),
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
  refundReturn: (id, payload) => api.post(`/api/admin/returns/${id}/refund`, payload).then((r) => r.data),

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
  assignCourier: (payload) => api.post("/api/admin/delivery/assign", payload).then((r) => r.data),
  trackDelivery: (orderId) => api.get(`/api/admin/delivery/track/${orderId}`).then((r) => r.data),
  cancelDelivery: (orderId) => api.post(`/api/admin/delivery/cancel/${orderId}`).then((r) => r.data),
  availableCouriers: () => api.get("/api/admin/delivery/couriers").then((r) => r.data),
  deliveryPriceEstimate: (payload) => api.post("/api/admin/delivery/price-estimate", payload).then((r) => r.data),
  pathaoCities: () => api.get("/api/admin/delivery/pathao/cities").then((r) => r.data),
  pathaoZones: (cityId) => api.get(`/api/admin/delivery/pathao/zones/${cityId}`).then((r) => r.data),
  pathaoAreas: (zoneId) => api.get(`/api/admin/delivery/pathao/areas/${zoneId}`).then((r) => r.data),
  pathaoStores: () => api.get("/api/admin/delivery/pathao/stores").then((r) => r.data),
  steadfastBalance: () => api.get("/api/admin/delivery/steadfast/balance").then((r) => r.data),

  // Payments extras
  refundPayment: (id, payload) => api.post(`/api/admin/payments/${id}/refund`, payload).then((r) => r.data),
  orderInvoice: (orderId) => api.get(`/api/admin/payments/invoice/${orderId}`).then((r) => r.data),

  // Disputes extras
  disputeDetail: (id) => api.get(`/api/admin/disputes/${id}`).then((r) => r.data),
  escalateDispute: (id) => api.post(`/api/admin/disputes/${id}/escalate`).then((r) => r.data),

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
  createProductVariant: (productId, payload) => api.post(`/api/admin/products/${productId}/variants`, payload).then((r) => r.data),
  updateProductVariant: (productId, variantId, payload) => api.put(`/api/admin/products/${productId}/variants/${variantId}`, payload).then((r) => r.data),
  deleteProductVariant: (productId, variantId) => api.delete(`/api/admin/products/${productId}/variants/${variantId}`).then((r) => r.data),
};

export async function safeApiCall(promise) {
  try {
    const response = await promise;
    return { data: response.data, error: null };
  } catch (error) {
    if (error.response && error.response.status === 401) {
      clearSession();
      window.location.reload();
    }
    return { data: null, error: error.response?.data?.detail || error.message || "API request failed" };
  }
}
