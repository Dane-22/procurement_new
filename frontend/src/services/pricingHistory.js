import api from './api';

const pricingHistoryService = {
  // Get all pricing history records with optional filters and pagination
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.item_id) params.append('item_id', filters.item_id);
    if (filters.supplier_id) params.append('supplier_id', filters.supplier_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    
    const queryString = params.toString();
    const response = await api.get(`/pricing-history${queryString ? `?${queryString}` : ''}`);
    return response.data;
  },

  // Get pricing history for a specific item
  getByItemId: async (itemId) => {
    const response = await api.get(`/pricing-history/item/${itemId}`);
    return response.data;
  },

  // Get pricing history for a specific supplier
  getBySupplierId: async (supplierId) => {
    const response = await api.get(`/pricing-history/supplier/${supplierId}`);
    return response.data;
  },

  // Get monthly pricing trends for dashboard chart
  getMonthlyTrends: async (itemId, months = 12, year = null) => {
    const params = new URLSearchParams();
    if (itemId) params.append('item_id', itemId);
    if (year) {
      params.append('year', year);
    } else if (months) {
      params.append('months', months);
    }
    
    const queryString = params.toString();
    const response = await api.get(`/pricing-history/trends/monthly${queryString ? `?${queryString}` : ''}`);
    return response.data;
  },

  // Get pricing statistics for an item
  getItemStats: async (itemId) => {
    const response = await api.get(`/pricing-history/stats/item/${itemId}`);
    return response.data;
  },

  // Create new pricing history record
  create: async (data) => {
    const response = await api.post('/pricing-history', data);
    return response.data;
  },

  // Update pricing history record
  update: async (id, data) => {
    const response = await api.put(`/pricing-history/${id}`, data);
    return response.data;
  },

  // Delete pricing history record
  delete: async (id) => {
    const response = await api.delete(`/pricing-history/${id}`);
    return response.data;
  }
};

export default pricingHistoryService;
