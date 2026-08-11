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

export const serviceRequestService = {
  list: async (params = {}) => {
    const view = params?.view ?? null;
    const page = params?.page ?? null;
    const pageSize = params?.pageSize ?? null;
    const status = params?.status ?? null;
    const q = params?.q ?? null;

    const key = `serviceRequests-list-${JSON.stringify({ view, page, pageSize, status, q })}`;

    return dedupeRequest(key, async () => {
      const queryParams = {};
      if (view) queryParams.view = view;
      if (page) queryParams.page = page;
      if (pageSize) queryParams.pageSize = pageSize;
      if (status) queryParams.status = Array.isArray(status) ? status.join(',') : status;
      if (q) queryParams.q = q;

      const response = await api.get('/service-requests', { params: queryParams, cache: false });
      return response.data;
    });
  },

  getAll: async (view) => {
    const key = `serviceRequests-getAll-${view || 'default'}`;
    return dedupeRequest(key, async () => {
      const pageSize = 100;
      const all = [];
      let page = 1;
      let total = Infinity;

      while (all.length < total) {
        const response = await api.get('/service-requests', {
          params: { ...(view ? { view } : {}), page, pageSize },
          cache: false
        });

        const payload = response.data || {};
        const serviceRequests = Array.isArray(payload.serviceRequests) ? payload.serviceRequests : [];
        total = Number.isFinite(payload.total) ? payload.total : serviceRequests.length;

        all.push(...serviceRequests);
        if (serviceRequests.length < pageSize) break;

        page += 1;
        if (page > 1000) break; // safety guard
      }

      const unique = new Map();
      for (const sr of all) {
        if (sr?.id == null) continue;
        unique.set(sr.id, sr);
      }

      return Array.from(unique.values());
    });
  },

  getById: async (id) => {
    return dedupeRequest(`serviceRequests-getById-${id}`, async () => {
      const response = await api.get(`/service-requests/${id}`);
      return response.data.serviceRequest;
    });
  },

  create: async (srData) => {
    const response = await api.post('/service-requests', srData);
    return response.data;
  },

  update: async (id, srData) => {
    const response = await api.put(`/service-requests/${id}`, srData);
    return response.data;
  },

  submit: async (id) => {
    const response = await api.put(`/service-requests/${id}/submit`);
    return response.data;
  },

  approve: async (id, status, rejectionReason) => {
    const response = await api.put(`/service-requests/${id}/approve`, { 
      status, 
      rejection_reason: rejectionReason 
    });
    return response.data;
  },

  procurementApprove: async (id, status, supplierId, rejectionReason) => {
    const response = await api.put(`/service-requests/${id}/procurement-approve`, {
      status,
      supplier_id: supplierId,
      rejection_reason: rejectionReason
    });
    return response.data;
  },

  superAdminApprove: async (id, status, rejectionReason, remarks) => {
    const response = await api.put(`/service-requests/${id}/super-admin-approve`, {
      status,
      rejection_reason: rejectionReason,
      remarks
    });
    return response.data;
  },

  markAsReceived: async (id) => {
    const response = await api.put(`/service-requests/${id}/received`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/service-requests/${id}`);
    return response.data;
  },

  exportToExcel: async (id) => {
    const response = await api.get(`/service-requests/${id}/export`, {
      responseType: 'blob'
    });
    return response.data;
  }
};
