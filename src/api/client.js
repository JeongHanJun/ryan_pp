import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: `${BASE_URL}/api`,
  // Render free-tier Web Services sleep after 15 min of inactivity; the first
  // request after a sleep takes 30–60s to wake the dyno. 60s gives breathing
  // room for that cold start without a spurious client timeout.
  timeout: 60000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('p4_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only auto-logout on token/auth failures, not on 401s from endpoints
    // that optionally use auth (leaderboards, trends).
    if (err.response?.status === 401 && err.config?.url?.startsWith('/auth')) {
      localStorage.removeItem('p4_token');
    }
    return Promise.reject(err);
  },
);

export default client;
