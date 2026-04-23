import axios from 'axios';
import { getApiErrorMessage } from '@/utils/apiError';

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://localhost:8000';
const API_BASE = `${BACKEND_URL.replace(/\/$/, '')}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('oceanBazarToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('oceanBazarToken');
      localStorage.removeItem('oceanBazarUser');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
};

// Product APIs
export const productAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => {
    if (id == null || String(id).trim() === '') {
      return Promise.reject(new Error('Missing product id'));
    }
    const segment = encodeURIComponent(String(id).trim());
    return api.get(`/products/${segment}`);
  },
};

// Category APIs
export const categoryAPI = {
  getAll: () => api.get('/categories'),
};

// Cart APIs
export const cartAPI = {
  get: () => api.get('/cart'),
  add: (data) => api.post('/cart/add', data),
  update: (data) => api.put('/cart/update', data),
  remove: (productId) => api.delete(`/cart/remove/${productId}`),
  reorderFromOrder: (orderId) => api.post(`/cart/reorder-from-order/${encodeURIComponent(orderId)}`),
};

export const profileAPI = {
  get: () => api.get('/profile'),
  update: (data) => api.put('/profile', data),
  getOrders: () => api.get('/profile/orders'),
  /** Multipart upload — axios clears Content-Type in interceptor so boundary is set correctly. */
  uploadPhoto: (formData) => api.post('/profile/photo', formData),
  requestReturn: (orderId, reason) =>
    api.post(`/profile/orders/${orderId}/return-request`, reason != null ? { reason } : {}),
};

/** Saved payment hints only — never send full card numbers (last 4 + metadata). */
export const paymentMethodsAPI = {
  list: () =>
    api.get('/profile/payment-methods').then((r) => ({
      ...r,
      data: {
        paymentMethods: Array.isArray(r.data?.paymentMethods) ? r.data.paymentMethods : [],
      },
    })),
  add: (data) => api.post('/profile/payment-methods', data),
  remove: (id) => {
    if (id == null || String(id).trim() === '') {
      return Promise.reject(new Error('Missing payment method id'));
    }
    return api.delete(`/profile/payment-methods/${encodeURIComponent(String(id).trim())}`);
  },
  setDefault: (id) => {
    if (id == null || String(id).trim() === '') {
      return Promise.reject(new Error('Missing payment method id'));
    }
    return api.patch(`/profile/payment-methods/${encodeURIComponent(String(id).trim())}/default`);
  },
};

export const orderAPI = {
  list: (params) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  getTracking: (id) => api.get(`/orders/${encodeURIComponent(String(id).trim())}/tracking`),
  dashboardStats: () => api.get('/orders/dashboard-stats'),
  recent: (limit) => api.get('/orders/recent', { params: { limit } }),
  place: (data) => api.post('/orders/place', data),
  submitFeedback: (orderId, body) =>
    api.post(`/orders/${encodeURIComponent(orderId)}/feedback`, body),
  /** Same as cart reorder — adds past order lines to cart. */
  reorder: (orderId) =>
    api.post(`/orders/${encodeURIComponent(String(orderId).trim())}/reorder`),
};

// Support chat APIs (used by ReportIssue/OpenDispute fallbacks)
export const chatAPI = {
  sendMessage: (message, sender = 'user') =>
    api.post('/chat/message', { message, sender }),
};

export const paymentAPI = {
  placeholder: (data) => api.post('/payments/placeholder', data),
  bkashPlaceholder: (data) => api.post('/payments/bkash/placeholder', data),
  nagadPlaceholder: (data) => api.post('/payments/nagad/placeholder', data),
  sslcommerzPlaceholder: (data) => api.post('/payments/sslcommerz/placeholder', data),
};

export const wholesaleAPI = {
  apply: (data) => api.post('/wholesale/apply', data),
  status: () => api.get('/wholesale/application-status'),
};

export const partnerAPI = {
  submitRequest: (data) => api.post('/partner-requests', data),
};

// Review APIs
export const reviewAPI = {
  getByProduct: (productId) => api.get(`/reviews/product/${encodeURIComponent(String(productId).trim())}`),
  submit: (data) => api.post('/reviews', data),
  markHelpful: (id) => api.post(`/reviews/${encodeURIComponent(String(id).trim())}/helpful`),
};

// Return APIs
export const returnAPI = {
  list: () => api.get('/returns/user/me'),
  getById: (id) => api.get(`/returns/${id}`),
  create: (data) => api.post('/returns', data),
};

// Coupon APIs
export const couponAPI = {
  validate: (code, total) => api.post('/coupons/validate', { code, total }),
};

// Seller APIs
export const sellerAPI = {
  getProfile: (id) => api.get(`/sellers/${id}`),
  register: (data) => api.post('/sellers/register', data),
};

// Notification APIs (customer)
export const notificationAPI = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  unreadCount: () => api.get('/notifications/unread-count'),
};

/** Public storefront contact & social URLs (no auth). */
function normalizeSiteSettingsPayload(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  return raw;
}

export const siteSettingsAPI = {
  get: () =>
    api.get('/site-settings').then((r) => normalizeSiteSettingsPayload(r?.data) ?? {}),
};

export default api;
export { getApiErrorMessage };
