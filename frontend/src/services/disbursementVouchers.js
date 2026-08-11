import api from './api.js';

export const disbursementVoucherService = {
  getAll: async () => {
    const response = await api.get('/disbursement-vouchers');
    return response.data.disbursementVouchers;
  },

  getById: async (id) => {
    const response = await api.get(`/disbursement-vouchers/${id}`);
    return response.data.disbursementVoucher;
  },

  getSchedules: async (sourceType, sourceId) => {
    const response = await api.get('/disbursement-vouchers/schedules', {
      params: {
        source_type: sourceType,
        source_id: sourceId
      }
    });
    return response.data;
  },

  create: async (dvData) => {
    const response = await api.post('/disbursement-vouchers', dvData);
    return response.data;
  },

  update: async (id, dvData) => {
    const response = await api.put(`/disbursement-vouchers/${id}`, dvData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/disbursement-vouchers/${id}`);
    return response.data;
  },

  certifyByAccounting: async (id) => {
    const response = await api.put(`/disbursement-vouchers/${id}/certify-accounting`);
    return response.data;
  },

  certifyByManager: async (id) => {
    const response = await api.put(`/disbursement-vouchers/${id}/certify-manager`);
    return response.data;
  },

  markAsPaid: async (id, paymentData) => {
    const response = await api.put(`/disbursement-vouchers/${id}/mark-paid`, paymentData);
    return response.data;
  },

  exportToExcel: async (id) => {
    const response = await api.get(`/disbursement-vouchers/${id}/export`, {
      responseType: 'blob'
    });
    return response.data;
  }
};
