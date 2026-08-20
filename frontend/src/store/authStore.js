import { create } from 'zustand';
import api from '../utils/api';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('healthwatch_token'),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('healthwatch_token', data.access_token);
      set({ user: data.user, token: data.access_token, loading: false });
      return data;
    } catch (err) {
      const msg = err.response?.data?.detail || 'Cannot reach the HealthWatch API. Start the backend on port 8000 and try again.';
      set({ error: msg, loading: false });
      throw err;
    }
  },

  register: async (formData) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/register', formData);
      localStorage.setItem('healthwatch_token', data.access_token);
      set({ user: data.user, token: data.access_token, loading: false });
      return data;
    } catch (err) {
      const msg = err.response?.data?.detail || 'Cannot reach the HealthWatch API. Start the backend on port 8000 and try again.';
      set({ error: msg, loading: false });
      throw err;
    }
  },

  fetchMe: async () => {
    const token = localStorage.getItem('healthwatch_token');
    if (!token) return;
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, token });
    } catch {
      localStorage.removeItem('healthwatch_token');
      set({ user: null, token: null });
    }
  },

  logout: () => {
    localStorage.removeItem('healthwatch_token');
    set({ user: null, token: null });
  },
}));
