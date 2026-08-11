import api from './api';

const emitReimbursementsChanged = (action, id = null) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('reimbursements:changed', {
    detail: { action, id }
  }));
};

export const reimbursementService = {
  getAll: async () => {
    const response = await api.get('/reimbursements', { cache: false });
    return response.data.reimbursements || [];
  },

  getById: async (id) => {
    const response = await api.get(`/reimbursements/${id}`, { cache: false });
    return response.data.reimbursement;
  },

  create: async (data) => {
    const response = await api.post('/reimbursements', data);
    emitReimbursementsChanged('created', response.data?.reimbursementId || null);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/reimbursements/${id}`, data);
    emitReimbursementsChanged('updated', Number(id));
    return response.data;
  },

  submit: async (id) => {
    const response = await api.put(`/reimbursements/${id}/submit`);
    emitReimbursementsChanged('submitted', Number(id));
    return response.data;
  },

  approve: async (id, status, rejectionReason = null) => {
    const response = await api.put(`/reimbursements/${id}/approve`, {
      status,
      rejection_reason: rejectionReason
    });
    emitReimbursementsChanged('approved', Number(id));
    return response.data;
  },

  markAsReceived: async (id) => {
    const response = await api.put(`/reimbursements/${id}/received`);
    emitReimbursementsChanged('received', Number(id));
    return response.data;
  },

  listAttachments: async (id) => {
    const response = await api.get(`/reimbursements/${id}/attachments`);
    return response.data.attachments || [];
  },

  uploadAttachments: async (id, files) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    const response = await api.post(`/reimbursements/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    emitReimbursementsChanged('attachment_uploaded', Number(id));
    return response.data;
  },

  deleteAttachment: async (id, attachmentId) => {
    const response = await api.delete(`/reimbursements/${id}/attachments/${attachmentId}`);
    emitReimbursementsChanged('attachment_deleted', Number(id));
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/reimbursements/${id}`);
    emitReimbursementsChanged('deleted', Number(id));
    return response.data;
  },

  exportToExcel: async (id) => {
    const response = await api.get(`/reimbursements/${id}/export`, {
      responseType: 'blob'
    });
    return response.data;
  },

  getPendingCount: async () => {
    const response = await api.get('/reimbursements/pending-count', { cache: false });
    return response.data;
  }
};
