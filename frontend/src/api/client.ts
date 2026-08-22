import axios from 'axios';
import { getInMemoryAccessToken, setInMemoryAccessToken } from '../context/AuthContext';
import type { TokenResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Dynamically attach Bearer token if available
apiClient.interceptors.request.use(
  (config) => {
    const token = getInMemoryAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Silent token refresh on 401 response
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not retry refresh requests or if already retried
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/v1/auth/refresh')
    ) {
      originalRequest._retry = true;
      const storedRefreshToken = localStorage.getItem('refresh_token');

      if (storedRefreshToken) {
        try {
          const refreshRes = await axios.post<TokenResponse>(
            `${API_BASE_URL}/api/v1/auth/refresh`,
            { refresh_token: storedRefreshToken }
          );

          const { access_token, refresh_token } = refreshRes.data;
          setInMemoryAccessToken(access_token);
          localStorage.setItem('refresh_token', refresh_token);

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(originalRequest);
        } catch (refreshErr) {
          console.warn('Silent token refresh failed:', refreshErr);
          setInMemoryAccessToken(null);
          localStorage.removeItem('refresh_token');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshErr);
        }
      } else {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
