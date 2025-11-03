import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Nur bei /auth/validate redirect, nicht bei Login-Versuchen oder Kiosk-APIs
      if (!error.config.url.includes('/auth/login') && 
          !error.config.url.includes('/auth/kiosk') && 
          !error.config.url.includes('/auth/scan') &&
          !error.config.url.includes('/attendance/kiosk')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 403) {
      toast.error('Keine Berechtigung für diese Aktion');
      return Promise.reject(error);
    }

    if (error.response?.status >= 500) {
      toast.error('Serverfehler. Bitte versuchen Sie es später erneut.');
      return Promise.reject(error);
    }

    if (error.code === 'ECONNABORTED') {
      toast.error('Zeitüberschreitung. Bitte versuchen Sie es erneut.');
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  kioskLogin: (credentials) => api.post('/auth/kiosk', credentials),
  scanLogin: (credentials) => api.post('/auth/scan', credentials),
  validateToken: () => api.get('/auth/validate'),
  logout: () => api.post('/auth/logout'),
};

// Users API
export const usersAPI = {
  getAll: (params = {}) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (userData) => api.post('/users', userData),
  update: (id, userData) => api.put(`/users/${id}`, userData),
  updatePassword: (id, passwordData) => api.patch(`/users/${id}/password`, passwordData),
  archive: (id) => api.delete(`/users/${id}`),
  restore: (id) => api.patch(`/users/${id}/restore`),
  getCurrentStatus: (id) => api.get(`/users/${id}/status`),
};

// Attendance API
export const attendanceAPI = {
  clockIn: (data) => api.post('/attendance/clock-in', data),
  clockOut: (data) => api.post('/attendance/clock-out', data),
  kioskClockIn: (data) => api.post('/attendance/kiosk/clock-in', data),
  kioskClockOut: (data) => api.post('/attendance/kiosk/clock-out', data),
  kioskGetCurrent: (data) => api.post('/attendance/kiosk/current', data),
  kioskGetToday: (data) => api.post('/attendance/kiosk/today', data),
  getCurrentAttendance: () => api.get('/attendance/current'),
  getAttendanceHistory: (params = {}) => api.get('/attendance/history', { params }),
  getAttendanceByUser: (userId, params = {}) => api.get(`/attendance/user/${userId}`, { params }),
  getActiveAttendances: () => api.get('/attendance/active'),
  updateAttendance: (id, data) => api.put(`/attendance/${id}`, data),
  deleteAttendance: (id) => api.delete(`/attendance/${id}`),
  getDailySummary: (userId, date) => api.get(`/attendance/summary/daily/${userId}/${date}`),
  getWeeklySummary: (userId, params) => api.get(`/attendance/summary/weekly/${userId}`, { params }),
};

// Work Orders API
export const workOrdersAPI = {
  getAll: (params = {}) => api.get('/work-orders', { params }),
  getActive: () => api.get('/work-orders/active'),
  getAssignableUsers: () => api.get('/work-orders/assignable-users'),
  getById: (id) => api.get(`/work-orders/${id}`),
  create: (orderData) => api.post('/work-orders', orderData),
  update: (id, orderData) => api.put(`/work-orders/${id}`, orderData),
  delete: (id) => api.delete(`/work-orders/${id}`),
  getSummary: (params = {}) => api.get('/work-orders/summary/stats', { params }),
  kioskGetAvailable: (data) => api.post('/work-orders/kiosk/available', data),
  kioskSearch: (data) => api.post('/work-orders/kiosk/search', data),
  kioskCreateOrFind: (data) => api.post('/work-orders/kiosk/create-or-find', data),
};

// Work Sessions API
export const workSessionsAPI = {
  getCurrent: () => api.get('/work-sessions/current'),
  getHistory: (params = {}) => api.get('/work-sessions/history', { params }),
  getActive: () => api.get('/work-sessions/active'),
  start: (sessionData) => api.post('/work-sessions/start', sessionData),
  stop: (data = {}) => api.post('/work-sessions/stop', data),
  kioskStart: (data) => api.post('/work-sessions/kiosk/start', data),
  kioskStartWithOrder: (data) => api.post('/work-sessions/kiosk/start-order', data),
  kioskStartWithCategory: (data) => api.post('/work-sessions/kiosk/start-category', data),
  kioskStop: (data) => api.post('/work-sessions/kiosk/stop', data),
  kioskStopSimple: (data) => api.post('/work-sessions/kiosk/stop-simple', data),
  kioskGetCurrent: (data) => api.post('/work-sessions/kiosk/current', data),
  kioskGetToday: (data) => api.post('/work-sessions/kiosk/today', data),
  getDailySummary: (userId, date) => api.get(`/work-sessions/summary/daily/${userId}/${date}`),
  getOrderSummary: (orderId) => api.get(`/work-sessions/summary/order/${orderId}`),
  getStatistics: (params = {}) => api.get('/work-sessions/stats', { params }),
  getUserStatistics: (userId, params = {}) => api.get(`/work-sessions/user-stats/${userId}`, { params }),
  update: (id, data) => api.put(`/work-sessions/${id}`, data),
  delete: (id) => api.delete(`/work-sessions/${id}`),
};

// Breaks API
export const breaksAPI = {
  getCurrent: () => api.get('/breaks/current'),
  start: (breakData) => api.post('/breaks/start', breakData),
  stop: (breakId, data = {}) => api.patch(`/breaks/${breakId}/stop`, data),
  kioskStart: (data) => api.post('/breaks/kiosk/start', data),
  kioskStartSimple: (data) => api.post('/breaks/kiosk/start-simple', data),
  kioskStop: (data) => api.post('/breaks/kiosk/stop', data),
  kioskStopSimple: (data) => api.post('/breaks/kiosk/stop-simple', data),
  kioskGetCurrent: (data) => api.post('/breaks/kiosk/current', data),
  kioskGetToday: (data) => api.post('/breaks/kiosk/today', data),
  getActive: () => api.get('/breaks/active'),
  getByUser: (userId, params = {}) => api.get(`/breaks/user/${userId}`, { params }),
  update: (id, data) => api.put(`/breaks/${id}`, data),
  delete: (id) => api.delete(`/breaks/${id}`),
};

// Categories API
export const categoriesAPI = {
  getAll: (params = {}) => api.get('/categories', { params }),
  getById: (id) => api.get(`/categories/${id}`),
  create: (categoryData) => api.post('/categories', categoryData),
  update: (id, categoryData) => api.put(`/categories/${id}`, categoryData),
  delete: (id) => api.delete(`/categories/${id}`),
  kioskGetAll: (data) => api.post('/categories/kiosk/all', data),
  getFreeWork: () => api.get('/system/free-work-categories'),
};

// Work Order Categories API
export const workOrderCategoriesAPI = {
  getAll: (params = {}) => api.get('/work-order-categories', { params }),
  getActive: () => api.get('/work-order-categories/active'),
  getById: (id) => api.get(`/work-order-categories/${id}`),
  create: (categoryData) => api.post('/work-order-categories', categoryData),
  update: (id, categoryData) => api.put(`/work-order-categories/${id}`, categoryData),
  delete: (id) => api.delete(`/work-order-categories/${id}`),
};

// Live Board API
export const liveBoardAPI = {
  getCurrentStatus: () => api.get('/live-board/status'),
  getActiveWorkSessions: () => api.get('/live-board/active-sessions'),
  getCurrentAttendance: () => api.get('/live-board/attendance'),
};

// System API  
export const systemAPI = {
  getUserStatus: (employeeNumber) => api.post('/system/user-status', { employeeNumber }),
  getSettings: () => api.get('/system/settings'),
  updateSetting: (key, value) => api.put('/system/settings', { key, value }),
  getAuditLog: (params = {}) => api.get('/system/audit-log', { params }),
  getStats: () => api.get('/system/stats'),
  backup: () => api.post('/system/backup'),
  getHealth: () => api.get('/health'),
};

// Reports API
export const reportsAPI = {
  getAttendanceReport: (params) => api.get('/reports/attendance', { params }),
  getAttendanceStatistics: (params) => api.get('/reports/attendance-stats', { params }),
  getBreakStatistics: (params) => api.get('/reports/break-stats', { params }),
  getActivityStatistics: (params) => api.get('/reports/activity-stats', { params }),
  getDetailedDaily: (params) => api.get('/reports/detailed-daily', { params }),
  getProductivityOverview: (params) => api.get('/reports/productivity-overview', { params }),
  getOverviewDashboard: (params) => api.get('/reports/overview-dashboard', { params }),
  getKpiSummary: (params) => api.get('/reports/kpi-summary', { params }),
  getWorkOrderReport: (params) => api.get('/reports/work-orders', { params }),
  getProductivityReport: (params) => api.get('/reports/productivity', { params }),
  exportAttendance: (params) => api.get('/reports/export/attendance', { 
    params, 
    responseType: 'blob' 
  }),
  exportWorkOrders: (params) => api.get('/reports/export/work-orders', { 
    params, 
    responseType: 'blob' 
  }),
  generatePDF: (reportType, params) => api.get(`/reports/pdf/${reportType}`, { 
    params, 
    responseType: 'blob' 
  }),
};

// Correction Requests API
export const correctionRequestsAPI = {
  getAll: (params = {}) => api.get('/corrections', { params }),
  getById: (id) => api.get(`/corrections/${id}`),
  create: (requestData) => api.post('/corrections', requestData),
  approve: (id, data = {}) => api.patch(`/corrections/${id}/approve`, data),
  reject: (id, data = {}) => api.patch(`/corrections/${id}/reject`, data),
  getByUser: (userId, params = {}) => api.get(`/corrections/user/${userId}`, { params }),
};


export default api;