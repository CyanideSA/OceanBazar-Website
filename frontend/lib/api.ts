import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  withCredentials: true,
});

// Attach access token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ob_access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {}, { withCredentials: true });
        localStorage.setItem('ob_access_token', data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.removeItem('ob_access_token');
        if (typeof window !== 'undefined') {
          const path = window.location.pathname;
          // Don't redirect if already on an auth page (prevents dark-screen loop)
          if (!path.includes('/auth/')) {
            const seg = path.split('/').filter(Boolean)[0];
            const localePrefix = seg && seg.length <= 5 ? `/${seg}` : '';
            window.location.href = `${localePrefix}/auth/login`;
          }
        }
      }
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  sendOtp: (target: string, type = 'login') => api.post('/auth/send-otp', { target, type }),
  verifyOtp: (target: string, code: string) => api.post('/auth/verify-otp', { target, code }),
  login: (identifier: string, password: string, recaptchaToken?: string) => api.post('/auth/login', { identifier, password, recaptchaToken }),
  register: (data: object) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
  forgotPassword: (target: string) => api.post('/auth/forgot-password', { target }),
  resetPassword: (target: string, otp: string, newPassword: string) =>
    api.post('/auth/reset-password', { target, otp, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
  resendVerification: () => api.post('/auth/resend-verification'),
  firebaseLogin: (idToken: string) => api.post('/auth/firebase', { idToken }),
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (params?: object) => api.get('/products', { params }),
  get: (id: string, locale?: string) => api.get(`/products/${id}`, { params: { lang: locale } }),
  compare: (ids: string[]) => api.get('/products/compare', { params: { ids: ids.join(',') } }),
};

// ─── Categories ───────────────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => api.get('/categories'),
};

// ─── Customers ───────────────────────────────────────────────────────────────
export const customersApi = {
  me: () => api.get('/customers/me'),
  updateMe: (data: object) => api.put('/customers/me', data),
};

// ─── Cart ─────────────────────────────────────────────────────────────────────
export const cartApi = {
  get: () => api.get('/cart'),
  add: (productId: string, quantity: number, variantId?: string) =>
    api.post('/cart/add', { productId, quantity, variantId }),
  update: (itemId: number, quantity: number) => api.put('/cart/update', { itemId, quantity }),
  remove: (productId: string) => api.delete(`/cart/remove/${productId}`),
  applyCoupon: (code: string) => api.post('/cart/apply-coupon', { code }),
  applyObPoints: (points: number) => api.post('/cart/apply-ob-points', { points }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersApi = {
  place: (data: object) => api.post('/orders/place', data),
  list: (page?: number) => api.get('/orders', { params: { page } }),
  get: (id: string) => api.get(`/orders/${id}`),
  tracking: (id: string) => api.get(`/orders/${id}/tracking`),
  cancel: (id: string) => api.post(`/orders/${id}/cancel`),
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentsApi = {
  bkashInitiate: (orderId: string) => api.post('/payments/bkash/initiate', { orderId }),
  bkashConfirm: (transactionId: string, providerTxId: string) =>
    api.post('/payments/bkash/confirm', { transactionId, providerTxId }),
  nagadInitiate: (orderId: string) => api.post('/payments/nagad/initiate', { orderId }),
  sslcommerz: (orderId: string) => api.post('/payments/sslcommerz/initiate', { orderId }),
  rocketInitiate: (orderId: string) => api.post('/payments/rocket/initiate', { orderId }),
  upayInitiate: (orderId: string) => api.post('/payments/upay/initiate', { orderId }),
};

// ─── OB Points ────────────────────────────────────────────────────────────────
export const obPointsApi = {
  balance: () => api.get('/ob-points/balance'),
  ledger: (page?: number) => api.get('/ob-points/ledger', { params: { page } }),
  redeem: (points: number) => api.post('/ob-points/redeem', { points }),
  tiers: () => api.get('/ob-points/tiers'),
};

// ─── Tickets ─────────────────────────────────────────────────────────────────
export const ticketsApi = {
  create: (data: object) => api.post('/tickets', data),
  list: () => api.get('/tickets'),
  get: (id: string) => api.get(`/tickets/${id}`),
  reply: (id: string, message: string, attachments?: string[]) =>
    api.post(`/tickets/${id}/messages`, { message, attachments }),
  markSeen: (id: string) => api.post(`/tickets/${id}/seen`),
};

// ─── Admin Tickets (CRM) ─────────────────────────────────────────────────────
export const adminTicketsApi = {
  list: (params?: object) => api.get('/admin/tickets', { params }),
  get: (id: string) => api.get(`/admin/tickets/${id}`),
  reply: (id: string, message: string, attachments?: string[]) =>
    api.post(`/admin/tickets/${id}/reply`, { message, attachments }),
  update: (id: string, data: object) => api.put(`/admin/tickets/${id}`, data),
  markSeen: (id: string) => api.post(`/admin/tickets/${id}/seen`),
};

// ─── Reviews ─────────────────────────────────────────────────────────────────
export const reviewsApi = {
  product: (productId: string, page?: number) =>
    api.get(`/reviews/product/${productId}`, { params: { page } }),
  me: () => api.get('/reviews/me'),
  submit: (data: { productId: string; rating: number; title?: string; body?: string; orderId?: string }) =>
    api.post('/reviews', data),
};

// ─── Profile ─────────────────────────────────────────────────────────────────
export const profileApi = {
  get: () => api.get('/profile'),
  update: (data: object) => api.put('/profile', data),
  addresses: () => api.get('/profile/addresses'),
  addAddress: (data: object) => api.post('/profile/addresses', data),
  updateAddress: (id: number, data: object) => api.put(`/profile/addresses/${id}`, data),
  deleteAddress: (id: number) => api.delete(`/profile/addresses/${id}`),
};

// ─── Storefront Settings ─────────────────────────────────────────────────────
export const storefrontApi = {
  settings: () => api.get('/storefront/settings'),
};

// ─── Delivery ────────────────────────────────────────────────────────────────
export const deliveryApi = {
  track: (trackingNumber: string) => api.get(`/delivery/track/${trackingNumber}`),
  carriers: () => api.get('/delivery/carriers'),
};

// ─── Notifications ──────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (userId: string) => api.get('/storefront/notifications', { params: { userId } }),
};

// ─── Chat ───────────────────────────────────────────────────────────────────
export const chatApi = {
  sessions: () => api.get('/chat/sessions'),
  messages: (sessionId: string) => api.get(`/chat/sessions/${sessionId}/messages`),
  send: (sessionId: string, content: string) =>
    api.post(`/chat/sessions/${sessionId}/messages`, { content }),
  startSession: () => api.post('/chat/sessions'),
};
