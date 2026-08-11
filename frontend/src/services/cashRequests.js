import api from './api';

export const cashRequestService = {
  list: async (params = {}) => {
    const view = params?.view ?? null;
    const page = params?.page ?? null;
    const pageSize = params?.pageSize ?? null;
    const status = params?.status ?? null;
    const q = params?.q ?? null;

    const queryParams = {};
    if (view) queryParams.view = view;
    if (page) queryParams.page = page;
    if (pageSize) queryParams.pageSize = pageSize;
    if (status) queryParams.status = Array.isArray(status) ? status.join(',') : status;
    if (q) queryParams.q = q;

    const response = await api.get('/cash-requests', { params: queryParams, cache: false });
    return response.data;
  },

  getAll: async (view) => {
    const pageSize = 100;
    const all = [];
    let page = 1;
    let total = Infinity;

    while (all.length < total) {
      const response = await api.get('/cash-requests', {
        params: { ...(view ? { view } : {}), page, pageSize },
        cache: false
      });

      const payload = response.data || {};
      const cashRequests = Array.isArray(payload.cashRequests) ? payload.cashRequests : [];
      total = Number.isFinite(payload.total) ? payload.total : cashRequests.length;

      all.push(...cashRequests);
      if (cashRequests.length < pageSize) break;

      page += 1;
      if (page > 1000) break; // safety guard
    }

    const unique = new Map();
    for (const cr of all) {
      if (cr?.id == null) continue;
      unique.set(cr.id, cr);
    }

    return Array.from(unique.values());
  },

  getById: async (id) => {
    const response = await api.get(`/cash-requests/${id}`);
    return response.data.cashRequest;
  },

  create: async (data) => {
    const response = await api.post('/cash-requests', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/cash-requests/${id}`, data);
    return response.data;
  },

  submit: async (id) => {
    const response = await api.put(`/cash-requests/${id}/submit`);
    return response.data;
  },

  approve: async (id, status, rejectionReason = null) => {
    const response = await api.put(`/cash-requests/${id}/approve`, {
      status,
      rejection_reason: rejectionReason
    });
    return response.data;
  },

  superAdminApprove: async (id, status, remarks = null) => {
    const response = await api.put(`/cash-requests/${id}/super-admin-approve`, {
      status,
      remarks
    });
    return response.data;
  },

  procurementApprove: async (id, status, remarks = null) => {
    const response = await api.put(`/cash-requests/${id}/procurement-approve`, {
      status,
      remarks
    });
    return response.data;
  },

  markAsReceived: async (id) => {
    const response = await api.put(`/cash-requests/${id}/received`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/cash-requests/${id}`);
    return response.data;
  },

  export: async (id) => {
    const response = await api.get(`/cash-requests/${id}/export`, {
      responseType: 'blob'
    });
    return response.data;
  }
};
