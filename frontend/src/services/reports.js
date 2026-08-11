import api from './api';

export const reportService = {
  getDashboardStats: async () => {
    const response = await api.get('/reports/dashboard');
    return response.data;
  },

  getMonthlySpending: async (year = new Date().getFullYear()) => {
    const response = await api.get('/reports/monthly-spending', { params: { year } });
    return response.data;
  },

  getSupplierPerformance: async () => {
    const response = await api.get('/reports/supplier-performance');
    return response.data;
  },

  getSpendingByCategory: async () => {
    const response = await api.get('/reports/spending-by-category');
    return response.data;
  },

  getTopSuppliers: async () => {
    const response = await api.get('/reports/top-suppliers');
    return response.data;
  },

  getPRStatusOverview: async () => {
    const response = await api.get('/reports/pr-status-overview');
    return response.data;
  }
};
