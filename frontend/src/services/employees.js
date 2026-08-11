import api, { clearApiCache } from './api';

export const employeeService = {
  getAll: async ({ page = 1, pageSize = 20 } = {}) => {
    const response = await api.get('/employees', {
      params: { page, pageSize },
      cache: false
    });
    return response.data;
  },

  create: async (employeeData) => {
    const response = await api.post('/employees', employeeData);
    clearApiCache();
    return response.data;
  },

  update: async (id, employeeData) => {
    const response = await api.put(`/employees/${id}`, employeeData);
    clearApiCache();
    return response.data;
  },

  resetPassword: async (id) => {
    const response = await api.post(`/employees/${id}/reset-password`);
    clearApiCache();
    return response.data;
  }
};
