import axios from 'axios';
import type { Token } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8004/api';
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

import type { ProductLine } from '@/types';

export const getProductLines = async (): Promise<ProductLine[]> => {
  const response = await apiClient.get('/projects/meta/product-lines');
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
  // Increase limit for tree view to get all resource plans
  params.append('limit', '10000');

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

// Team Dashboard Types
export type TeamDashboardScope = 'sub_team' | 'department' | 'business_unit' | 'all';
export type DashboardViewMode = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface TeamDashboardData {
  team_info: {
    name: string;
    code: string;
    scope: TeamDashboardScope;
    member_count: number;
    org_path: string[];
  };
  date_range: {
    start: string;
    end: string;
    view_mode: DashboardViewMode;
  };
  team_worklogs: {
    total_hours: number;
    by_project: Array<{
      project_id: string;
      project_code: string;
      project_name: string;
      hours: number;
    }>;
    project_vs_functional: {
      Project: number;
      Functional: number;
    };
  };
  member_contributions: Array<{
    user_id: string;
    name: string;
    korean_name: string | null;
    hours: number;
    percentage: number;
  }>;
  resource_allocation: {
    current_month: string;
    total_planned_fte: number;
    active_projects: number;
  };
  org_context: {
    org_total_hours: number;
    team_percentage: number;
  };
}

export const getTeamDashboard = async (
  scope: TeamDashboardScope = 'department',
  viewMode: DashboardViewMode = 'weekly'
): Promise<TeamDashboardData> => {
  const response = await apiClient.get(`/dashboard/team-summary?scope=${scope}&view_mode=${viewMode}`);
  return response.data;
};

// ============ Job Positions API ============

export interface JobPositionCreate {
  name: string;
  department_id?: string;
  sub_team_id?: string;
  is_active?: boolean;
}

export interface JobPositionUpdate {
  name?: string;
  department_id?: string;
  sub_team_id?: string;
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

// ============ Project Roles API ============

export interface ProjectRole {
  id: string;
  name: string;
  category?: string;
  is_active: boolean;
  user_count?: number;
  project_count?: number;
}

export interface ProjectRoleCreate {
  name: string;
  category?: string;
}

export interface ProjectRoleUpdate {
  name?: string;
  category?: string;
  is_active?: boolean;
}

export const getProjectRoles = async (includeInactive = false): Promise<ProjectRole[]> => {
  const response = await apiClient.get(`/project-roles?include_inactive=${includeInactive}`);
  return response.data;
};

export const createProjectRole = async (data: ProjectRoleCreate): Promise<ProjectRole> => {
  const response = await apiClient.post('/project-roles', data);
  return response.data;
};

export const updateProjectRole = async (id: string, data: ProjectRoleUpdate): Promise<ProjectRole> => {
  const response = await apiClient.put(`/project-roles/${id}`, data);
  return response.data;
};

export const deleteProjectRole = async (id: string): Promise<void> => {
  await apiClient.delete(`/project-roles/${id}`);
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

// Worklog Summary by Project (for Plan vs Actual comparison)
export interface WorklogProjectSummary {
  project_id: string;
  project_code: string;
  project_name: string;
  year: number;
  month: number;
  total_hours: number;
  total_fte: number;
}

export const getWorklogSummaryByProject = async (): Promise<WorklogProjectSummary[]> => {
  const response = await apiClient.get('/reports/worklog-summary/by-project');
  return response.data;
};

// ============ Organization API ============

export interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  business_unit_id: string;
  is_active: boolean;
}

export interface SubTeam {
  id: string;
  name: string;
  code: string;
  department_id: string;
  is_active: boolean;
}

export interface UserDetails {
  id: string;
  name: string;
  korean_name: string | null;
  email: string;
  department_id: string;
  sub_team_id: string | null;
  position_id: string;
  role: string;
  is_active: boolean;
}

export interface UserHistoryEntry {
  id: number;
  user_id: string;
  department_id: string;
  sub_team_id: string | null;
  position_id: string;
  start_date: string;
  end_date: string | null;
  change_type: string;
  remarks: string | null;
}

// Business Units
export const getBusinessUnits = async (): Promise<BusinessUnit[]> => {
  const response = await apiClient.get('/departments/business-units');
  return response.data;
};

export const createBusinessUnit = async (data: Omit<BusinessUnit, 'id'>): Promise<BusinessUnit> => {
  const response = await apiClient.post('/departments/business-units', data);
  return response.data;
};

export const updateBusinessUnit = async (id: string, data: Partial<BusinessUnit>): Promise<BusinessUnit> => {
  const response = await apiClient.put(`/departments/business-units/${id}`, data);
  return response.data;
};

export const deleteBusinessUnit = async (id: string): Promise<void> => {
  await apiClient.delete(`/departments/business-units/${id}`);
};

// Departments
export const getDepartments = async (businessUnitId?: string): Promise<Department[]> => {
  const params = businessUnitId ? `?business_unit_id=${businessUnitId}` : '';
  const response = await apiClient.get(`/departments${params}`);
  return response.data;
};

export const createDepartment = async (data: Omit<Department, 'id'>): Promise<Department> => {
  const response = await apiClient.post('/departments', data);
  return response.data;
};

export const updateDepartment = async (id: string, data: Partial<Department>): Promise<Department> => {
  const response = await apiClient.put(`/departments/${id}`, data);
  return response.data;
};

export const deleteDepartment = async (id: string): Promise<void> => {
  await apiClient.delete(`/departments/${id}`);
};

// Sub-Teams
export const getSubTeams = async (departmentId: string): Promise<SubTeam[]> => {
  const response = await apiClient.get(`/departments/${departmentId}/sub-teams`);
  return response.data;
};

export const createSubTeam = async (departmentId: string, data: Omit<SubTeam, 'id' | 'department_id'>): Promise<SubTeam> => {
  const response = await apiClient.post(`/departments/${departmentId}/sub-teams`, { ...data, department_id: departmentId });
  return response.data;
};

export const updateSubTeam = async (id: string, data: Partial<SubTeam>): Promise<SubTeam> => {
  const response = await apiClient.put(`/departments/sub-teams/${id}`, data);
  return response.data;
};

export const deleteSubTeam = async (id: string): Promise<void> => {
  await apiClient.delete(`/departments/sub-teams/${id}`);
};

// Users (for Resources tab)
export const getUsers = async (departmentId?: string, isActive?: boolean): Promise<UserDetails[]> => {
  const params = new URLSearchParams();
  if (departmentId) params.append('department_id', departmentId);
  if (isActive !== undefined) params.append('is_active', String(isActive));
  params.append('limit', '500');
  const response = await apiClient.get(`/users?${params.toString()}`);
  return response.data;
};

export const getUserHistory = async (userId: string): Promise<UserHistoryEntry[]> => {
  const response = await apiClient.get(`/users/${userId}/history`);
  return response.data;
};

export const createUserHistory = async (userId: string, data: Omit<UserHistoryEntry, 'id' | 'user_id'>): Promise<UserHistoryEntry> => {
  const response = await apiClient.post(`/users/${userId}/history`, data);
  return response.data;
};

export const updateUserHistory = async (userId: string, historyId: number, data: Partial<UserHistoryEntry>): Promise<UserHistoryEntry> => {
  const response = await apiClient.put(`/users/${userId}/history/${historyId}`, data);
  return response.data;
};

export const deleteUserHistory = async (userId: string, historyId: number): Promise<void> => {
  await apiClient.delete(`/users/${userId}/history/${historyId}`);
};

export interface UserUpdate {
  name?: string;
  korean_name?: string;
  department_id?: string;
  sub_team_id?: string | null;
  position_id?: string;
  role?: string;
  is_active?: boolean;
}

export const updateUser = async (userId: string, data: UserUpdate): Promise<UserDetails> => {
  const response = await apiClient.put(`/users/${userId}`, data);
  return response.data;
};

// ============ Hiring Plans API ============

export interface HiringPlan {
  id: string;
  department_id: string;
  position_id: string | null;
  target_date: string;
  headcount: number;
  status: string;
  remarks: string | null;
  hired_user_id: string | null;
}

export interface HeadcountForecast {
  target_date: string;
  department_id: string | null;
  current_headcount: number;
  planned_hires: number;
  forecasted_headcount: number;
}

export const getHiringPlans = async (filters?: { department_id?: string; status?: string; from_date?: string; to_date?: string }): Promise<HiringPlan[]> => {
  const params = new URLSearchParams();
  if (filters?.department_id) params.append('department_id', filters.department_id);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.from_date) params.append('from_date', filters.from_date);
  if (filters?.to_date) params.append('to_date', filters.to_date);
  const response = await apiClient.get(`/hiring-plans?${params.toString()}`);
  return response.data;
};

export const createHiringPlan = async (data: Omit<HiringPlan, 'id' | 'hired_user_id'>): Promise<HiringPlan> => {
  const response = await apiClient.post('/hiring-plans', data);
  return response.data;
};

export const updateHiringPlan = async (id: string, data: Partial<HiringPlan>): Promise<HiringPlan> => {
  const response = await apiClient.put(`/hiring-plans/${id}`, data);
  return response.data;
};

export const deleteHiringPlan = async (id: string): Promise<void> => {
  await apiClient.delete(`/hiring-plans/${id}`);
};

export const getHeadcountForecast = async (targetDate: string, departmentId?: string): Promise<HeadcountForecast> => {
  const params = new URLSearchParams();
  params.append('target_date', targetDate);
  if (departmentId) params.append('department_id', departmentId);
  const response = await apiClient.get(`/hiring-plans/forecast/headcount?${params.toString()}`);
  return response.data;
};

export const fillHiringPlan = async (planId: string, userId: string): Promise<{ message: string; plan_id: string; hired_user_id: string; hired_user_name: string }> => {
  const response = await apiClient.post(`/hiring-plans/${planId}/fill?user_id=${userId}`);
  return response.data;
};

export default apiClient;
