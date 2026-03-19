import axios from 'axios';

// In development: package.json "proxy" forwards /api/* to localhost:8000
// In production:  set REACT_APP_API_URL=https://your-backend.railway.app
const BASE = process.env.REACT_APP_API_URL || '';

const http = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

http.interceptors.response.use(
  r => r,
  e => Promise.reject(new Error(e.response?.data?.detail || e.message || 'Network error'))
);

// ── Dashboard ──────────────────────────────────────────────────────────
export const api = {
  // Dashboard
  getDashboard:    ()          => http.get('/api/dashboard/summary'),
  getRecentSales:  (n = 8)    => http.get(`/api/dashboard/recent-sales?limit=${n}`),
  getSalesChart:   ()          => http.get('/api/dashboard/sales-chart'),

  // Inventory
  getOverview:     ()          => http.get('/api/inventory/overview'),
  getMedicines:    (p = {})    => http.get('/api/medicines', { params: p }),
  getMedicine:     (id)        => http.get(`/api/medicines/${id}`),
  getCategories:   ()          => http.get('/api/medicines/categories'),
  createMedicine:  (d)         => http.post('/api/medicines', d),
  updateMedicine:  (id, d)     => http.put(`/api/medicines/${id}`, d),
  markStatus:      (id, s)     => http.patch(`/api/medicines/${id}/status?status=${encodeURIComponent(s)}`),
  deleteMedicine:  (id)        => http.delete(`/api/medicines/${id}`),

  // Sales
  createSale:      (d)         => http.post('/api/sales', d),
  getSales:        (p = 1)     => http.get(`/api/sales?page=${p}`),

  // Purchase orders
  getPurchaseOrders: ()        => http.get('/api/purchase-orders'),

  // Health
  health:          ()          => http.get('/health'),
};

export default api;
