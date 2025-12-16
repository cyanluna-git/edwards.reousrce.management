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
  // Increase limit for project-based queries to get all months
  params.append('limit', '500');

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

// ============ Resource Plan Summary API ============

export interface ProjectSummary {
  project_id: string;
  project_code: string;
  project_name: string;
  year: number;
  month: number;
  total_hours: number;
}

export interface PositionSummary {
  position_id: string;
  position_name: string;
  year: number;
  month: number;
  total_hours: number;
  count: number;
}

export const getSummaryByProject = async (): Promise<ProjectSummary[]> => {
  const response = await apiClient.get('/resource-plans/summary/by-project');
  return response.data;
};

export const getSummaryByPosition = async (): Promise<PositionSummary[]> => {
  const response = await apiClient.get('/resource-plans/summary/by-position');
  return response.data;
};

// ============ Dashboard API ============

export interface DashboardData {
  user: {
    id: string;
    name: string;
    email: string;
  };
  weekly_worklog: {
    week_start: string;
    week_end: string;
    total_hours: number;
    by_project: Array<{
      project_id: string;
      project_code: string;
      project_name: string;
      hours: number;
    }>;
  };
  resource_allocation: {
    current_month: string;
    total_fte: number;
    active_projects: number;
  };
  my_projects: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    milestones: Array<{
      name: string;
      target_date: string | null;
      status: string;
    }>;
  }>;
}

export const getMyDashboard = async (): Promise<DashboardData> => {
  const response = await apiClient.get('/dashboard/my-summary');
  return response.data;
};

// ============ Job Positions API ============

export interface JobPositionCreate {
  name: string;
  department_id?: string;
  is_active?: boolean;
}

export interface JobPositionUpdate {
  name?: string;
  department_id?: string;
  is_active?: boolean;
}

export const getJobPositionsList = async (includeInactive = false): Promise<JobPosition[]> => {
  const response = await apiClient.get(`/job-positions?include_inactive=${includeInactive}`);
  return response.data;
};

export const createJobPosition = async (data: JobPositionCreate): Promise<JobPosition> => {
  const response = await apiClient.post('/job-positions', data);
  return response.data;
};

export const updateJobPosition = async (id: string, data: JobPositionUpdate): Promise<JobPosition> => {
  const response = await apiClient.put(`/job-positions/${id}`, data);
  return response.data;
};

export const deleteJobPosition = async (id: string): Promise<void> => {
  await apiClient.delete(`/job-positions/${id}`);
};

// ============ Reports API ============

export interface CapacitySummary {
  year: number;
  monthly: Array<{
    month: number;
    total_fte: number;
    plan_count: number;
  }>;
  by_position: Array<{
    name: string;
    total_fte: number;
  }>;
  by_project: Array<{
    code: string;
    name: string;
    total_fte: number;
  }>;
}

export interface WorklogSummary {
  year: number;
  monthly: Array<{
    month: number;
    total_hours: number;
    log_count: number;
  }>;
  by_type: Array<{
    type: string;
    total_hours: number;
  }>;
  by_project: Array<{
    code: string;
    name: string;
    total_hours: number;
  }>;
}

export const getCapacitySummary = async (year?: number): Promise<CapacitySummary> => {
  const params = year ? `?year=${year}` : '';
  const response = await apiClient.get(`/reports/capacity-summary${params}`);
  return response.data;
};

export const getWorklogSummary = async (year?: number): Promise<WorklogSummary> => {
  const params = year ? `?year=${year}` : '';
  const response = await apiClient.get(`/reports/worklog-summary${params}`);
  return response.data;
};

export default apiClient;
