import api from './api.js';

// In-flight request tracking to prevent duplicate simultaneous requests
const inFlightRequests = new Map();

const dedupeRequest = async (key, requestFn) => {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }
  
  const promise = requestFn().finally(() => {
    inFlightRequests.delete(key);
  });
  
  inFlightRequests.set(key, promise);
  return promise;
};

export const paymentRequestService = {
  getAll: async () => {
    return dedupeRequest('paymentRequests-getAll', async () => {
      const response = await api.get('/payment-requests');
      return response.data.paymentRequests;
    });
  },

  getById: async (id) => {
    const response = await api.get(`/payment-requests/${id}`);
    return response.data.paymentRequest;
  },

  create: async (prData) => {
    const response = await api.post('/payment-requests', prData);
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await api.put(`/payment-requests/${id}/status`, { status });
    return response.data;
  },

  approve: async (id, status, rejectionReason = null) => {
    const response = await api.put(`/payment-requests/${id}/approve`, { 
      status, 
      rejection_reason: rejectionReason 
    });
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/payment-requests/${id}`);
    return response.data;
  },

  exportToExcel: async (id) => {
    const response = await api.get(`/payment-requests/${id}/export`, {
      responseType: 'blob'
    });
    return response.data;
  }
};
