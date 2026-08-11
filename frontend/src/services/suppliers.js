import api from './api';

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

export const supplierService = {
  getAll: async (params = {}) => {
    return dedupeRequest('suppliers-getAll', async () => {
      const response = await api.get('/suppliers', { params, cache: false });
      return response.data;
    });
  },

  getById: async (id) => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data.supplier;
  },

  create: async (supplierData) => {
    const response = await api.post('/suppliers', supplierData);
    return response.data;
  },

  update: async (id, supplierData) => {
    const response = await api.put(`/suppliers/${id}`, supplierData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },

  getFromPRRequests: async () => {
    const response = await api.get('/suppliers/from-pr-requests');
    return response.data.suppliers;
  },

  updateAccreditation: async (supplierName, accredited, accreditationNotes) => {
    const response = await api.put(`/suppliers/${encodeURIComponent(supplierName)}/accredit`, { accredited, accreditation_notes: accreditationNotes });
    return response.data;
  },

  uploadAccreditationFiles: async (supplierName, files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await api.post(`/suppliers/${encodeURIComponent(supplierName)}/accreditation-files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  deleteAccreditationFile: async (supplierName, filename) => {
    const response = await api.delete(`/suppliers/${encodeURIComponent(supplierName)}/accreditation-files/${encodeURIComponent(filename)}`);
    return response.data;
  },

  getAccreditationFileUrl: (supplierName, filename) => {
    return `/api/suppliers/${encodeURIComponent(supplierName)}/accreditation-files/${filename}`;
  },

  getAccreditationFile: async (supplierName, filename) => {
    const response = await api.get(`/suppliers/${encodeURIComponent(supplierName)}/accreditation-files/${encodeURIComponent(filename)}`, {
      responseType: 'blob'
    });
    return response.data;
  }
};
