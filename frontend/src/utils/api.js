import axios from 'axios';

const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
const apiBaseUrl = configuredUrl
  ? (configuredUrl.endsWith('/api') ? configuredUrl : `${configuredUrl}/api`)
  : 'http://localhost:8000/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = typeof window === 'undefined' ? null : localStorage.getItem('healthwatch_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 from /auth/login is an invalid credential error, not an expired
    // session. Only clear and redirect an existing authenticated session.
    const hasSession = typeof window !== 'undefined' && Boolean(localStorage.getItem('healthwatch_token'));
    if (error.response?.status === 401 && hasSession && !error.config?.url?.endsWith('/auth/login')) {
      localStorage.removeItem('healthwatch_token');
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
