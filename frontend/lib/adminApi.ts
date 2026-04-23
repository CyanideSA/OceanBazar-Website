import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const adminApi = axios.create({
  baseURL: `${BASE}/api/admin`,
  withCredentials: true,
});

adminApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const t = localStorage.getItem('ob_admin_token');
    if (t) config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

export const adminAuth = {
  login: (username: string, password: string) => adminApi.post('/auth/login', { username, password }),
  me: () => adminApi.get('/auth/me'),
};

export const adminStudio = {
  overview: () => adminApi.get('/overview'),
  catalogTree: () => adminApi.get('/catalog-tree'),
  brands: () => adminApi.get('/brands'),
  getProduct: (id: string) => adminApi.get(`/products/${id}`),
  updateProduct: (id: string, data: object) => adminApi.put(`/products/${id}`, data),
  moveProduct: (id: string, categoryId: string) => adminApi.patch(`/products/${id}/category`, { categoryId }),
  createCategory: (data: object) => adminApi.post('/categories', data),
  updateCategory: (id: string, data: object) => adminApi.put(`/categories/${id}`, data),
  deleteCategory: (id: string) => adminApi.delete(`/categories/${id}`),
  createProduct: (data: object) => adminApi.post('/products', data),
  fileScan: (rootPath?: string) => adminApi.post('/file-import/scan', { rootPath }),
  fileExecute: (body: { rootPath?: string; dryRun?: boolean; selectedCategories?: string[] }) =>
    adminApi.post('/file-import/execute', body),
  coupons: () => adminApi.get('/coupons'),
  createCoupon: (data: object) => adminApi.post('/coupons', data),
  updateCoupon: (id: number, data: object) => adminApi.put(`/coupons/${id}`, data),
  shipments: () => adminApi.get('/shipments'),
  updateShipment: (id: string, data: object) => adminApi.put(`/shipments/${id}`, data),
  analytics: () => adminApi.get('/analytics/dashboard'),
  orders: (page?: number) => adminApi.get('/orders', { params: { page } }),
  tickets: (params?: object) => adminApi.get('/tickets', { params }),
  ticket: (id: string) => adminApi.get(`/tickets/${id}`),
  updateTicket: (id: string, data: object) => adminApi.put(`/tickets/${id}`, data),
  replyTicket: (id: string, message: string, attachments?: string[]) =>
    adminApi.post(`/tickets/${id}/reply`, { message, attachments }),
  markSeenTicket: (id: string) => adminApi.post(`/tickets/${id}/seen`),
  getOrder: (id: string) => adminApi.get(`/orders/${id}`),
  updateOrderStatus: (id: string, status: string, note?: string) =>
    adminApi.put(`/orders/${id}/status`, { status, note }),
  customers: (params?: object) => adminApi.get('/customers', { params }),
  getCustomer: (id: string) => adminApi.get(`/customers/${id}`),
  reviews: (params?: object) => adminApi.get('/reviews', { params }),
  updateReview: (id: string, status: 'approved' | 'rejected') =>
    adminApi.patch(`/reviews/${id}`, { status }),
  deleteProduct: (id: string) => adminApi.delete(`/products/${id}`),
};
