import axios from 'axios';
import { normalizeCartSummary } from './cart';
import type { CartSummary } from '@/types';
import { useAuthStore } from '@/stores/authStore';

/** BFF origin: env at build time; in dev (loopback env), match page hostname so LAN/docker access works. */
export function resolvePublicApiBase(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
  if (typeof window === 'undefined') return fromEnv;

  let envHost = '';
  let envPort = '4000';
  try {
    const u = new URL(fromEnv);
    envHost = u.hostname.toLowerCase();
    envPort = u.port || '4000';
  } catch { /* fall through to loopback handling */ }

  const envIsLoopback = !envHost || envHost === 'localhost' || envHost === '127.0.0.1' || envHost === '::1' || envHost === '[::1]';
  // Production/staging: the env URL is a real public origin — never rewrite it.
  if (!envIsLoopback) return fromEnv;

  // Dev only: page opened via LAN IP/docker host — mirror the page hostname with the BFF port.
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return fromEnv;
  return `${protocol}//${hostname}:${envPort}`;
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
    let deviceId = localStorage.getItem('ob_device_id');
    if (!deviceId) {
      // Avoid crypto.randomUUID — missing on older Safari; optional-call syntax can also
      // fail to parse if the bundle is not downleveled for iOS < 13.1.
      deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem('ob_device_id', deviceId);
    }
    config.headers['X-Device-Id'] = deviceId;
    config.headers['X-Request-Id'] = `ob-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
  return config;
});

// Single-flight refresh: concurrent 401s share one /auth/refresh request so a
// page refresh (many parallel API calls) rotates the session exactly once.
let refreshInFlight: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${resolvePublicApiBase()}/api/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        localStorage.setItem('ob_access_token', data.access);
        return data.access as string;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function clearZombieClientAuth() {
  try {
    useAuthStore.getState().logout();
  } catch {
    localStorage.removeItem('ob_access_token');
    localStorage.removeItem('ob-auth');
  }
}

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      // Attempt refresh when we have an access token OR the UI still claims the
      // customer is logged in (persisted Zustand). Otherwise guests stay anonymous.
      const hadToken = typeof window !== 'undefined' && !!localStorage.getItem('ob_access_token');
      const claimedAuth =
        typeof window !== 'undefined' &&
        (localStorage.getItem('ob-auth')?.includes('"isAuthenticated":true') ||
          useAuthStore.getState().isAuthenticated);
      if (!hadToken && !claimedAuth) {
        return Promise.reject(err);
      }

      try {
        const access = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch (refreshError) {
        clearZombieClientAuth();
        if (typeof window !== 'undefined') {
          const path = window.location.pathname;
          // Only redirect to login from protected pages (account, orders, checkout)
          // Never from public pages (homepage, products, product detail)
          const protectedPaths = ['/account', '/orders', '/checkout', '/wishlist'];
          const isProtected = protectedPaths.some(p => path.includes(p));
          if (isProtected && !path.includes('/auth/')) {
            const seg = path.split('/').filter(Boolean)[0];
            const localePrefix = seg && seg.length <= 5 ? `/${seg}` : '';
            const next = encodeURIComponent(path + (window.location.search || ''));
            window.location.href = `${localePrefix}/auth/login?next=${next}`;
          }
        }
        return Promise.reject(err);
      }
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
const cartRequest = async (p: Promise<{ data: unknown }>): Promise<CartSummary> => {
  const { data } = await p;
  return normalizeCartSummary(data ?? { items: [] });
};

export const cartApi = {
  get: async () => cartRequest(api.get('/cart')),
  add: (productId: string, quantity: number, variantId?: string) =>
    cartRequest(api.post('/cart/add', { productId, quantity, variantId })),
  update: (productId: string, quantity: number, variantId?: string | null) =>
    cartRequest(api.put('/cart/update', { productId, quantity, variantId: variantId ?? undefined })),
  remove: (productId: string, variantId?: string | null) =>
    cartRequest(
      api.delete(`/cart/remove/${productId}`, {
        params: variantId ? { variantId } : undefined,
      })
    ),
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
  surveyState: (id: string) => api.get(`/orders/${id}/survey`),
  submitSurvey: (id: string, data: object) => api.post(`/orders/${id}/survey`, data),
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentsApi = {
  bkashInitiate: (orderId: string) => api.post('/payments/bkash/initiate', { orderId }),
  bkashConfirm: (transactionId: string, providerTxId: string) =>
    api.post('/payments/bkash/confirm', { transactionId, providerTxId }),
  nagadInitiate: (orderId: string) => api.post('/payments/nagad/initiate', { orderId }),
  sslcommerz: (orderId: string, opts?: { purpose?: 'order_total' | 'delivery_fee'; storefront?: string; locale?: string }) =>
    api.post('/payments/sslcommerz/initiate', { orderId, ...opts }),
  sslcommerzConfig: () => api.get('/payments/sslcommerz/config'),
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
  submitRefundAccount: (id: string, data: { method: string; accountNumber: string; accountName?: string; bankName?: string; branchName?: string; notes?: string }) =>
    api.post(`/returns/${id}/refund-account`, data),
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

export const wholesaleApi = {
  apply: (data: {
    businessName: string;
    tradeLicense: string;
    address: string;
    notes?: string;
  }) => api.post('/wholesale/apply', data),
  status: () => api.get('/wholesale/status'),
};

// ─── Back-in-Stock ──────────────────────────────────────────────────────────
export const stockNotifyApi = {
  subscribe: (productId: string, email: string) =>
    api.post('/products/notify-stock', { productId, email }),
};

// ─── Q&A ────────────────────────────────────────────────────────────────────
export const qaApi = {
  list: (productId: string) => api.get(`/qa/${productId}`),
  ask: (
    productId: string,
    payload: { question: string; askerName?: string; askerEmail?: string; imageUrls?: string[] },
  ) => api.post(`/qa/${productId}`, payload),
};

// ─── Upload (Cloudinary) ───────────────────────────────────────────────────
export const uploadApi = {
  profilePhoto: (file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    return api.post('/upload/profile-photo', fd);
  },
  image: (file: File, folder = 'reviews') => {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('folder', folder);
    return api.post('/upload/image', fd);
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
  trustBadges: () => api.get('/trust-badges'),
};

export const businessInquiriesApi = {
  submit: (payload: {
    name: string;
    email: string;
    company?: string;
    phone?: string;
    businessType?: string;
    message: string;
  }) => api.post('/business-inquiries', payload),
};

// ─── Delivery ────────────────────────────────────────────────────────────────
export const deliveryApi = {
  track: (trackingNumber: string) => api.get(`/delivery/track/${trackingNumber}`),
  carriers: () => api.get('/delivery/carriers'),
  pathaoCities: () => api.get('/delivery/pathao/cities'),
  pathaoZones: (cityId: number) => api.get(`/delivery/pathao/zones/${cityId}`),
  pathaoAreas: (zoneId: number) => api.get(`/delivery/pathao/areas/${zoneId}`),
  pathaoQuote: (body: {
    shippingAddressId?: number;
    pathaoCityId?: number;
    pathaoZoneId?: number;
    itemCount?: number;
  }) => api.post('/delivery/pathao/quote', body),
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
