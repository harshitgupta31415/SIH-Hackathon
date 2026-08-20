import { create } from 'zustand';
import api from '../utils/api';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  initialized: false,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('healthwatch_token', data.access_token);
      set({ user: data.user, token: data.access_token, initialized: true, loading: false });
      return data;
    } catch (err) {
      const msg = err.response?.data?.detail || 'Cannot reach the Jal Jeevan Swasthya API. Check the configured API URL and try again.';
      set({ error: msg, loading: false });
      throw err;
    }
  },

  register: async (formData) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/register', {
        ...formData,
        phone: formData.phone?.trim() || null,
      });
      localStorage.setItem('healthwatch_token', data.access_token);
      set({ user: data.user, token: data.access_token, initialized: true, loading: false });
      return data;
    } catch (err) {
      const msg = err.response?.data?.detail || 'Cannot reach the Jal Jeevan Swasthya API. Check the configured API URL and try again.';
      set({ error: msg, loading: false });
      throw err;
    }
  },

  fetchMe: async () => {
    const token = localStorage.getItem('healthwatch_token');
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, token, initialized: true });
    } catch {
      localStorage.removeItem('healthwatch_token');
      set({ user: null, token: null, initialized: true });
    }
  },

  logout: () => {
    localStorage.removeItem('healthwatch_token');
    set({ user: null, token: null, initialized: true, error: null });
  },
}));
