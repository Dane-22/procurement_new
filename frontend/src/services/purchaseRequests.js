import api from './api';

// In-flight request tracking to prevent duplicate simultaneous requests
const inFlightRequests = new Map();

const dedupeRequest = async (key, requestFn) => {
  // Clear any existing cache for this key to ensure fresh data
  inFlightRequests.delete(key);
  
  const promise = requestFn().finally(() => {
    inFlightRequests.delete(key);
  });
  
  inFlightRequests.set(key, promise);
  return promise;
};

export const purchaseRequestService = {
  list: async (params = {}) => {
    const view = params?.view ?? null;
    const page = params?.page ?? null;
    const pageSize = params?.pageSize ?? null;
    const status = params?.status ?? null;
    const q = params?.q ?? null;
    const pending_review = params?.pending_review ?? null;

    const key = `list-${JSON.stringify({ view, page, pageSize, status, q, pending_review })}`;

    return dedupeRequest(key, async () => {
      const queryParams = {};
      if (view) queryParams.view = view;
      if (page) queryParams.page = page;
      if (pageSize) queryParams.pageSize = pageSize;
      if (status) queryParams.status = Array.isArray(status) ? status.join(',') : status;
      if (q) queryParams.q = q;
      if (pending_review) queryParams.pending_review = pending_review;

      const response = await api.get('/purchase-requests', { params: queryParams, cache: false });
      return response.data;
    });
  },

  getAll: async (view, filters = {}) => {
    const status = filters?.status ?? null;
    const key = `getAll-${view || 'default'}-${status || 'any'}`;
    return dedupeRequest(key, async () => {
      const pageSize = 100;
      const all = [];
      let page = 1;
      let total = Infinity;

      while (all.length < total) {
        const params = { page, pageSize };
        if (view) params.view = view;
        if (status) params.status = status;

        const response = await api.get('/purchase-requests', {
          params,
          cache: false
        });

        const payload = response.data || {};
        const purchaseRequests = Array.isArray(payload.purchaseRequests) ? payload.purchaseRequests : [];
        total = Number.isFinite(payload.total) ? payload.total : purchaseRequests.length;

        all.push(...purchaseRequests);
        if (purchaseRequests.length < pageSize) break;

        page += 1;
        if (page > 1000) break; // safety guard
      }

      // De-dupe by id (in case data changes mid-pagination)
      const unique = new Map();
      for (const pr of all) {
        if (pr?.id == null) continue;
        unique.set(pr.id, pr);
      }

      return Array.from(unique.values());
    });
  },

  getById: async (id) => {
    return dedupeRequest(`getById-${id}`, async () => {
      const response = await api.get(`/purchase-requests/${id}`, { cache: false });
      return response.data.purchaseRequest;
    });
  },

create: async (prData, accreditationFiles = []) => {
  const formData = new FormData();
  formData.append('purpose', prData.purpose);
  formData.append('project', prData.project || '');
  formData.append('project_address', prData.project_address || '');
  formData.append('date_needed', prData.date_needed || '');
  formData.append('order_number', prData.order_number || '');
  formData.append('supplier_id', prData.supplier_id || '');
  formData.append('supplier_name', prData.supplier_name || '');
  formData.append('supplier_address', prData.supplier_address || '');
  formData.append('payment_basis', prData.payment_basis);
  formData.append('payment_terms_note', prData.payment_terms_note || '');
  formData.append('remarks', prData.remarks || '');
  formData.append('items', JSON.stringify(prData.items));
  formData.append('payment_schedules', JSON.stringify(prData.payment_schedules));

  // Add accreditation files
  accreditationFiles.forEach(file => {
    formData.append('accreditation_files', file);
  });

  const response = await api.post('/purchase-requests', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
},

  superAdminFirstApprove: async (id, status, remarks, itemRemarks) => {
    const response = await api.put(`/purchase-requests/${id}/super-admin-first-approve`, { status, remarks, item_remarks: itemRemarks });
    return response.data;
  },

  procurementApprove: async (
    id,
    status,
    rejection_reason,
    items,
    supplier_id,
    supplier_address,
    itemRemarks,
    payment_terms_code = null,
    payment_terms_note = null
  ) => {
    const response = await api.put(`/purchase-requests/${id}/procurement-approve`, {
      status,
      rejection_reason,
      items,
      supplier_id,
      supplier_address,
      item_remarks: itemRemarks,
      payment_terms_code,
      payment_terms_note
    });
    return response.data;
  },

  // Legacy endpoint
  approve: async (id, status, remarks) => {
    const response = await api.put(`/purchase-requests/${id}/approve`, { status, remarks });
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await api.put(`/purchase-requests/${id}/status`, { status });
    return response.data;
  },

  markAsReceived: async (id) => {
    const response = await api.put(`/purchase-requests/${id}/received`);
    return response.data;
  },

  exportToExcel: async (id) => {
    const response = await api.get(`/purchase-requests/${id}/export`, {
      responseType: 'blob'
    });
    return response.data;
  },

  resubmit: async (id, prData) => {
    const response = await api.put(`/purchase-requests/${id}/resubmit`, prData);
    return response.data;
  },

saveDraft: async (prData) => {
  const response = await api.post('/purchase-requests', {
    purpose: prData.purpose,
    project: prData.project,
    project_address: prData.project_address,
    date_needed: prData.date_needed,
    order_number: prData.order_number,
    supplier_id: prData.supplier_id,
    supplier_name: prData.supplier_name,
    supplier_address: prData.supplier_address, // ← ADD THIS LINE
    payment_basis: prData.payment_basis,
    payment_terms_note: prData.payment_terms_note,
    payment_schedules: prData.payment_schedules,
    remarks: prData.remarks,
    items: prData.items,
    save_as_draft: true
  });
  return response.data;
},

  updateDraft: async (id, prData) => {
    const response = await api.put(`/purchase-requests/${id}/draft`, prData);
    return response.data;
  },

  submitDraft: async (id) => {
    const response = await api.put(`/purchase-requests/${id}/submit-draft`);
    return response.data;
  },

  review: async (id, reviewStatus, reviewComment) => {
    const response = await api.post(`/purchase-requests/${id}/review`, {
      review_status: reviewStatus,
      review_comment: reviewComment
    });
    return response.data;
  },

  checkSupplierAccreditation: async (supplierName) => {
    const response = await api.get(`/purchase-requests/check-supplier-accreditation/${encodeURIComponent(supplierName)}`);
    return response.data;
  }
};
