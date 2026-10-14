import api from './api';

export const pettyCashRequestService = {
  list: async () => (await api.get('/petty-cash-requests', { cache: false })).data.pettyCashRequests,
  getById: async (id) => (await api.get(`/petty-cash-requests/${id}`, { cache: false })).data.pettyCashRequest,
  create: async (data) => (await api.post('/petty-cash-requests', data)).data,
  update: async (id, data) => (await api.put(`/petty-cash-requests/${id}`, data)).data,
  submit: async (id) => (await api.post(`/petty-cash-requests/${id}/submit`)).data,
  review: async (id, decision, comment = '') => (await api.post(`/petty-cash-requests/${id}/review`, { decision, comment })).data,
  release: async (id) => (await api.post(`/petty-cash-requests/${id}/release`)).data,
  receive: async (id) => (await api.post(`/petty-cash-requests/${id}/receive`)).data,
  submitLiquidation: async (id, formData) => (await api.post(`/petty-cash-requests/${id}/liquidation`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
  reviewLiquidation: async (id, data) => (await api.post(`/petty-cash-requests/${id}/liquidation/review`, data)).data,
  downloadLiquidationReceipt: async (id, receiptId) => (await api.get(`/petty-cash-requests/${id}/liquidation/receipts/${receiptId}`, { responseType: 'blob', cache: false })).data,
  export: async (id) => (await api.get(`/petty-cash-requests/${id}/export`, { responseType: 'blob' })).data
};
