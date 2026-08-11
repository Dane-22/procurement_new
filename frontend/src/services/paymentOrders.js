import api from './api';

const BASE_URL = '/payment-orders';

export const paymentOrderService = {
  getAll: async (status = 'all') => {
    const params = status !== 'all' ? `?status=${status}` : '';
    const response = await api.get(`${BASE_URL}${params}`);
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post(BASE_URL, data);
    return response.data;
  },

  updateStatus: async (id, status, remarks = '') => {
    const response = await api.patch(`${BASE_URL}/${id}/status`, { status, remarks });
    return response.data;
  },

  superAdminApprove: async (id, status) => {
    const response = await api.patch(`${BASE_URL}/${id}/super-admin-approve`, { status });
    return response.data;
  },

  export: async (id) => {
    const response = await api.get(`${BASE_URL}/${id}/export`, {
      responseType: 'blob'
    });
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`${BASE_URL}/${id}`);
    return response.data;
  }
};
