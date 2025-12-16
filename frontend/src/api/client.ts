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

// ============ Milestones API ============

import type { ProjectMilestone, ProjectMilestoneCreate, ProjectMilestoneUpdate, Program, ProjectType } from '@/types';

export const getMilestones = async (projectId: string): Promise<ProjectMilestone[]> => {
  const response = await apiClient.get(`/projects/${projectId}/milestones`);
  return response.data;
};

export const createMilestone = async (projectId: string, data: ProjectMilestoneCreate): Promise<ProjectMilestone> => {
  const response = await apiClient.post(`/projects/${projectId}/milestones`, data);
  return response.data;
};

export const updateMilestone = async (
  projectId: string,
  milestoneId: number,
  data: ProjectMilestoneUpdate
): Promise<ProjectMilestone> => {
  const response = await apiClient.put(`/projects/${projectId}/milestones/${milestoneId}`, data);
  return response.data;
};

export const deleteMilestone = async (projectId: string, milestoneId: number): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}/milestones/${milestoneId}`);
};

// ============ Meta API ============

export const getPrograms = async (): Promise<Program[]> => {
  const response = await apiClient.get('/projects/meta/programs');
  return response.data;
};

export const getProjectTypes = async (): Promise<ProjectType[]> => {
  const response = await apiClient.get('/projects/meta/types');
  return response.data;
};

// ============ Resource Plans API ============

import type { ResourcePlan, ResourcePlanCreate, ResourcePlanUpdate, ResourcePlanAssign, JobPosition } from '@/types';

export interface ResourcePlanFilters {
  project_id?: string;
  year?: number;
  month?: number;
  position_id?: string;
  user_id?: string;
}

export const getResourcePlans = async (filters?: ResourcePlanFilters): Promise<ResourcePlan[]> => {
  const params = new URLSearchParams();
  if (filters?.project_id) params.append('project_id', filters.project_id);
  if (filters?.year) params.append('year', String(filters.year));
  if (filters?.month) params.append('month', String(filters.month));
  if (filters?.position_id) params.append('position_id', filters.position_id);
  if (filters?.user_id) params.append('user_id', filters.user_id);

  const response = await apiClient.get(`/resource-plans?${params.toString()}`);
  return response.data;
};

export const getTbdPositions = async (filters?: Pick<ResourcePlanFilters, 'project_id' | 'year' | 'month'>): Promise<ResourcePlan[]> => {
  const params = new URLSearchParams();
  if (filters?.project_id) params.append('project_id', filters.project_id);
  if (filters?.year) params.append('year', String(filters.year));
  if (filters?.month) params.append('month', String(filters.month));

  const response = await apiClient.get(`/resource-plans/tbd?${params.toString()}`);
  return response.data;
};

export const getResourcePlan = async (planId: number): Promise<ResourcePlan> => {
  const response = await apiClient.get(`/resource-plans/${planId}`);
  return response.data;
};

export const createResourcePlan = async (data: ResourcePlanCreate): Promise<ResourcePlan> => {
  const response = await apiClient.post('/resource-plans', data);
  return response.data;
};

export const updateResourcePlan = async (planId: number, data: ResourcePlanUpdate): Promise<ResourcePlan> => {
  const response = await apiClient.put(`/resource-plans/${planId}`, data);
  return response.data;
};

export const deleteResourcePlan = async (planId: number): Promise<void> => {
  await apiClient.delete(`/resource-plans/${planId}`);
};

export const assignUserToPlan = async (planId: number, data: ResourcePlanAssign): Promise<ResourcePlan> => {
  const response = await apiClient.post(`/resource-plans/${planId}/assign`, data);
  return response.data;
};

export const getJobPositions = async (): Promise<JobPosition[]> => {
  const response = await apiClient.get('/resource-plans/meta/positions');
  return response.data;
};

export default apiClient;
