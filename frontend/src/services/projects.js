import api from './api';

export const projectService = {
  getAll: async () => {
    const response = await api.get('/projects', { cache: false });
    return Array.isArray(response.data) ? response.data : [];
  },

  getActive: async () => {
    const projects = await projectService.getAll();
    return projects.filter((project) => project?.is_active && !project?.is_locked_order);
  }
};
