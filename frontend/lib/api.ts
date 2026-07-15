import axios from 'axios';

/** BFF origin: env at build time; in the browser, match page hostname so LAN/docker access works. */
export function resolvePublicApiBase(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
  if (typeof window === 'undefined') return fromEnv;
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return fromEnv;
  try {
    const port = new URL(fromEnv).port || '4000';
    return `${protocol}//${hostname}:${port}`;
  } catch {
    return `${protocol}//${hostname}:4000`;
  }
}

export const api = axios.create({
  baseURL: `${resolvePublicApiBase()}/api`,
  withCredentials: true,
});

// Attach access token from localStorage
api.interceptors.request.use((config) => {
  config.baseURL = `${resolvePublicApiBase()}/api`;
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ob_access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const rid =
      (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
      `ob-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    config.headers['X-Request-Id'] = rid;
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

      // Only attempt refresh if the user had a token (was previously authenticated).
      // For truly anonymous calls (wishlist/cart sync etc.) there's no token, so we
      // silently reject without redirecting — guests should be able to browse freely.
      const hadToken = typeof window !== 'undefined' && !!localStorage.getItem('ob_access_token');
      if (!hadToken) {
        return Promise.reject(err);
      }

      try {
        const { data } = await axios.post(`${resolvePublicApiBase()}/api/auth/refresh`, {}, { withCredentials: true });
        localStorage.setItem('ob_access_token', data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.removeItem('ob_access_token');
        if (typeof window !== 'undefined') {
          const path = window.location.pathname;
          // Only redirect to login from protected pages (account, orders, checkout)
          // Never from public pages (homepage, products, product detail)
          const protectedPaths = ['/account', '/orders', '/checkout', '/wishlist'];
          const isProtected = protectedPaths.some(p => path.includes(p));
          if (isProtected && !path.includes('/auth/')) {
            const seg = path.split('/').filter(Boolean)[0];
            const localePrefix = seg && seg.length <= 5 ? `/${seg}` : '';
            window.location.href = `${localePrefix}/auth/login`;
          }
        }
      }
    }
    const url = String(original?.url || '');
    if (err.response?.status && /\/(cart|upload\/profile-photo|auth\/)/.test(url)) {
      // #region agent log
      fetch('http://127.0.0.1:7768/ingest/4878ed05-f1ac-4ebb-915b-84a7969025f6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'74a2e3'},body:JSON.stringify({sessionId:'74a2e3',hypothesisId:'A-D',location:'api.ts:interceptor',message:'storefront api error',data:{url,status:err.response.status,detail:err.response?.data},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  sendOtp: (target: string, type = 'login') => api.post('/auth/send-otp', { target, type }),
  verifyOtp: (target: string, code: string, type = 'login') => api.post('/auth/verify-otp', { target, code, type }),
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
  filters: (lang?: string) => api.get('/products/filters', { params: { lang } }),
  topBrands: () => api.get('/products/top-brands'),
};

// ─── Brands ──────────────────────────────────────────────────────────────────
export const brandsApi = {
  list: () => api.get('/brands'),
  get: (slugOrId: string) => api.get(`/brands/${slugOrId}`),
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
  reorder: (id: string) => api.post(`/orders/${id}/reorder`),
  trackPublic: (orderNumber: string, phone: string) =>
    api.post('/orders/track-public', { orderNumber, phone }),
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

// ─── Wishlist ───────────────────────────────────────────────────────────────
export const wishlistApi = {
  get: () => api.get('/wishlist'),
  toggle: (productId: string) => api.post('/wishlist/toggle', { productId }),
  sync: (ids: string[]) => api.post('/wishlist/sync', { ids }),
};

// ─── Returns ─────────────────────────────────────────────────────────────────
export const returnsApi = {
  create: (data: { orderId: string; reason?: string; reasonCategory?: string; description?: string; items?: object[]; images?: string[] }) =>
    api.post('/returns', data),
  list: () => api.get('/returns'),
  get: (id: string) => api.get(`/returns/${id}`),
};

// ─── Reviews ─────────────────────────────────────────────────────────────────
export const reviewsApi = {
  product: (productId: string, params?: { page?: number; sort?: string; rating?: number }) =>
    api.get(`/reviews/product/${productId}`, { params }),
  me: () => api.get('/reviews/me'),
  submit: (data: { productId: string; rating: number; title?: string; body?: string; orderId?: string; imageUrls?: string[]; lang?: string }) =>
    api.post('/reviews', data),
  voteHelpful: (id: string) => api.post(`/reviews/${id}/helpful`),
};

// ─── Newsletter ──────────────────────────────────────────────────────────────
export const newsletterApi = {
  subscribe: (email: string) => api.post('/newsletter/subscribe', { email }),
};

// ─── Back-in-Stock ──────────────────────────────────────────────────────────
export const stockNotifyApi = {
  subscribe: (productId: string, email: string) =>
    api.post('/products/notify-stock', { productId, email }),
};

// ─── Q&A ────────────────────────────────────────────────────────────────────
export const qaApi = {
  list: (productId: string) => api.get(`/qa/${productId}`),
  ask: (productId: string, payload: { question: string; askerName?: string; askerEmail?: string }) =>
    api.post(`/qa/${productId}`, payload),
};

// ─── Upload (Cloudinary) ───────────────────────────────────────────────────
export const uploadApi = {
  profilePhoto: (file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    return api.post('/upload/profile-photo', fd);
  },
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

// ─── Referral ────────────────────────────────────────────────────────────────
export const referralApi = {
  myCode: () => api.get('/referral/my-code'),
  stats: () => api.get('/referral/stats'),
  trackClick: (code: string) => api.post('/referral/track-click', { code }),
  claim: (code: string) => api.post('/referral/claim', { code }),
};

// ─── Push Notifications ──────────────────────────────────────────────────────
export const pushApi = {
  vapidKey: () => api.get('/push/vapid-key'),
  subscribe: (endpoint: string, keys: { p256dh: string; auth: string }) =>
    api.post('/push/subscribe', { endpoint, keys }),
  unsubscribe: (endpoint: string) => api.delete('/push/subscribe', { data: { endpoint } }),
};

// ─── A/B Tests ───────────────────────────────────────────────────────────────
export const abApi = {
  impression: (testId: string, variant: string, sessionId?: string) =>
    api.post('/ab/impression', { testId, variant, sessionId }),
  conversion: (testId: string, variant: string) => api.post('/ab/conversion', { testId, variant }),
  stats: () => api.get('/ab/stats'),
};
