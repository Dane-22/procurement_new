import api from './api';

export const authService = {
  login: async (employee_no, password) => {
    const response = await api.post('/auth/login', { employee_no, password });
    const { token, user } = response.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return { 
      token,
      user,
      message: 'Login successful'
    };
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getToken: () => {
    return localStorage.getItem('token');
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  changePassword: async (current_password, new_password, confirm_password) => {
    const response = await api.post('/auth/change-password', {
      current_password,
      new_password,
      confirm_password
    });
    return response.data;
  }
};
