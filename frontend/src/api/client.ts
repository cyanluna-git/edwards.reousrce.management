import axios from 'axios';
import type { Token } from '@/types';

const API_BASE_URL = 'http://localhost:8000/api';
const AUTH_TOKEN_KEY = 'authToken';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      localStorage.removeItem(AUTH_TOKEN_KEY);
      // In a real app, you might want to use a router history object
      // to push to the login page instead of a hard refresh.
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Logs in a user
 * @param email The user's email
 * @param password The user's password
 * @returns The response data containing the access token
 */
export const loginUser = async (email: string, password: string): Promise<Token> => {
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);

  const response = await apiClient.post('/auth/login', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return response.data;
};

export default apiClient;
