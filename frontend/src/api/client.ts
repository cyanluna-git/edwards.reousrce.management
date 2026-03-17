import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import type { Token } from '@/types';

// Standardized API error response type
export interface ApiError {
  code: string;
  message: string;
  [key: string]: unknown;
}

/**
 * Extract standardized error from axios error response.
 * Backend returns: { code: "ERROR_CODE", message: "Human-readable message" }
 */
export function getApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data;
    if (data.code) return data as ApiError;
    if (data.detail) {
      if (typeof data.detail === 'object' && data.detail.code) return data.detail as ApiError;
      return { code: 'UNKNOWN', message: typeof data.detail === 'string' ? data.detail : 'An unknown error occurred' };
    }
  }
  return { code: 'UNKNOWN', message: 'An unknown error occurred' };
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const AUTH_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

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

// Token refresh state
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
};

// Response interceptor with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't try to refresh for auth endpoints that handle their own 401s
      if (originalRequest.url === '/auth/refresh' || originalRequest.url === '/auth/login') {
        if (originalRequest.url === '/auth/refresh') {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` };
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post<Token>(
          `${API_BASE_URL}/auth/refresh`,
          { refresh_token: refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const { access_token, refresh_token: newRefreshToken } = response.data;
        localStorage.setItem(AUTH_TOKEN_KEY, access_token);
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

        processQueue(null, access_token);

        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${access_token}` };
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
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

  const response = await apiClient.post<Token>('/auth/login', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data;
};

// ============ SSO Registration API ============

export interface SSORegistrationData {
  registration_token: string;
  name: string;
  korean_name: string;
  department_id: string;
  position_id: string;
}

export const ssoRegister = async (data: SSORegistrationData): Promise<Token> => {
  const response = await apiClient.post<Token>('/auth/sso/register', data);
  return response.data;
};

export interface ReleaseNotesAckResponse {
  success: boolean;
  seen_release_note_version: string;
}

export const acknowledgeReleaseNotes = async (version: string): Promise<ReleaseNotesAckResponse> => {
  const response = await apiClient.post<ReleaseNotesAckResponse>('/auth/release-notes/ack', { version });
  return response.data;
};

// ============ Milestones API ============

import type { ProjectMilestone, ProjectMilestoneCreate, ProjectMilestoneUpdate } from '@/types';

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

// getPrograms removed - Program entity no longer exists

import type { ProductLine } from '@/types';

export const getProductLines = async (): Promise<ProductLine[]> => {
  const response = await apiClient.get('/projects/meta/product-lines');
  return response.data;
};

export const createProductLine = async (data: Omit<ProductLine, 'id'>): Promise<ProductLine> => {
  // @ts-ignore - Create type matches omit id
  const response = await apiClient.post('/projects/product-lines', data);
  return response.data;
};

export const updateProductLine = async (id: string, data: Partial<ProductLine>): Promise<ProductLine> => {
  const response = await apiClient.put(`/projects/product-lines/${id}`, data);
  return response.data;
};

export const deleteProductLine = async (id: string): Promise<void> => {
  await apiClient.delete(`/projects/product-lines/${id}`);
};

// ============ Projects API ============
import type { Project, ProjectCreate, ProjectUpdate } from '@/types';

export const getProjects = async (params?: any): Promise<Project[]> => {
  const response = await apiClient.get('/projects', { params });
  return response.data;
};

export const createProject = async (data: ProjectCreate): Promise<Project> => {
  const response = await apiClient.post('/projects', data);
  return response.data;
};

export const updateProject = async (id: string, data: ProjectUpdate): Promise<Project> => {
  const response = await apiClient.put(`/projects/${id}`, data);
  return response.data;
};

export const deleteProject = async (id: string): Promise<void> => {
  await apiClient.delete(`/projects/${id}`);
};

export const getProject = async (id: string): Promise<Project> => {
  const response = await apiClient.get(`/projects/${id}`);
  return response.data;
};



// ============ Resource Plans API ============

import type {
  ResourcePlan,
  ResourcePlanCreate,
  ResourcePlanUpdate,
  ResourcePlanAssign,
  ResourcePlanHistory,
  JobPosition,
} from '@/types';

export interface ResourcePlanFilters {
  project_id?: string;
  year?: number;
  month?: number;
  position_id?: string;
  user_id?: string;
}

export interface ResourcePlanHistoryFilters {
  project_id: string;
  position_id: string;
  project_role_id?: string;
  user_id?: string;
  is_tbd?: boolean;
  limit?: number;
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

export const getResourcePlanHistory = async (
  filters: ResourcePlanHistoryFilters
): Promise<ResourcePlanHistory[]> => {
  const params = new URLSearchParams();
  params.append('project_id', filters.project_id);
  params.append('position_id', filters.position_id);
  if (filters.project_role_id) params.append('project_role_id', filters.project_role_id);
  if (filters.user_id) params.append('user_id', filters.user_id);
  if (filters.is_tbd) params.append('is_tbd', 'true');
  if (filters.limit) params.append('limit', String(filters.limit));

  const response = await apiClient.get(`/resource-plans/history?${params.toString()}`);
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
      category: string;
      hours: number;
    }>;
    project_vs_functional: {
      Project: number;
      Functional: number;
    };
    by_category?: {
      Product: number;
      Functional: number;
      Support: number;
      TeamInternal: number;
    };
  };
  member_contributions: Array<{
    user_id: string;
    name: string;
    korean_name: string | null;
    hours: number;
    percentage: number;
  }>;
  sub_org_contributions: Array<{
    org_id: string;
    org_name: string;
    org_code: string;
    member_count: number;
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
  viewMode: DashboardViewMode = 'weekly',
  dateRange?: { start: string; end: string },
  orgId?: string,
): Promise<TeamDashboardData> => {
  const params = new URLSearchParams({
    scope,
    view_mode: viewMode,
  });
  if (dateRange) {
    params.append('start_date', dateRange.start);
    params.append('end_date', dateRange.end);
  }
  if (orgId) {
    params.append('org_id', orgId);
  }
  const response = await apiClient.get(`/dashboard/team-summary?${params.toString()}`);
  return response.data;
};

// My FTE Types
export interface MyFTEProjectItem {
  project_id: string;
  project_code: string;
  project_name: string;
  category: 'PRODUCT' | 'FUNCTIONAL' | 'SUPPORT';
  planned_fte: number | null;
  actual_fte: number;
  utilization_percent: number | null;
}

export interface MyFTEResponse {
  year: number;
  month: number;
  working_hours_per_month: number;
  summary: {
    planned_fte: number;
    actual_fte: number;
    utilization_percent: number | null;
  };
  product_functional: {
    planned: MyFTEProjectItem[];
    unplanned: MyFTEProjectItem[];
  };
  support: MyFTEProjectItem[];
}

export const getMyFTE = async (year: number, month: number): Promise<MyFTEResponse> => {
  const response = await apiClient.get(`/dashboard/my-fte?year=${year}&month=${month}`);
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

// Worklog Summary by Role (for Plan vs Actual comparison by position)
export interface WorklogRoleSummary {
  position_id: string;
  position_name: string;
  year: number;
  month: number;
  total_hours: number;
  total_fte: number;
}

export const getWorklogSummaryByRole = async (): Promise<WorklogRoleSummary[]> => {
  const response = await apiClient.get('/reports/worklog-summary/by-role');
  return response.data;
};

// ============ Organization API ============

// Organization Entities
export interface Division {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

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
  business_unit_id: string | null; // Nullable
  division_id: string | null; // NEW
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
  division_id: string | null;
  department_id: string | null;
  sub_team_id: string | null;
  position_id: string;
  primary_business_unit_id: string | null;
  role: string;
  is_active: boolean;
}

export interface UserHistoryEntry {
  id: number;
  user_id: string;
  division_id: string | null;
  department_id: string | null;
  sub_team_id: string | null;
  position_id: string;
  start_date: string;
  end_date: string | null;
  change_type: string;
  remarks: string | null;
}

// Divisions
export const getDivisions = async (): Promise<Division[]> => {
  const response = await apiClient.get('/divisions');
  return response.data;
};

export const createDivision = async (data: Omit<Division, 'id'>): Promise<Division> => {
  const response = await apiClient.post('/divisions', data);
  return response.data;
};

export const updateDivision = async (id: string, data: Partial<Division>): Promise<Division> => {
  const response = await apiClient.put(`/divisions/${id}`, data);
  return response.data;
};

export const deleteDivision = async (id: string): Promise<void> => {
  await apiClient.delete(`/divisions/${id}`);
};

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
export const getDepartments = async (businessUnitId?: string, isActive?: boolean): Promise<Department[]> => {
  const params = new URLSearchParams();
  if (businessUnitId) params.append('business_unit_id', businessUnitId);
  if (isActive !== undefined) params.append('is_active', String(isActive));

  const response = await apiClient.get(`/departments?${params.toString()}`);
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
export const getUsers = async (departmentId?: string, isActive?: boolean, includeInactive = false): Promise<UserDetails[]> => {
  const params = new URLSearchParams();
  if (departmentId) params.append('department_id', departmentId);
  if (includeInactive) {
    params.append('include_inactive', 'true');
  } else if (isActive !== undefined) {
    params.append('is_active', String(isActive));
  }
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
  korean_name?: string | null;
  division_id?: string | null;
  department_id?: string | null;
  sub_team_id?: string | null;
  position_id?: string;
  primary_business_unit_id?: string | null;
  role?: string;
  is_active?: boolean;
}

export interface UserCreate {
  email: string;
  name: string;
  korean_name?: string | null;
  division_id?: string | null;
  department_id?: string | null;
  sub_team_id?: string | null;
  position_id: string;
  primary_business_unit_id?: string | null;
  role?: string;
  is_active?: boolean;
  password: string;
}

export const createUser = async (data: UserCreate): Promise<UserDetails> => {
  const response = await apiClient.post('/users', data);
  return response.data;
};

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

// ============ Resource Matrix API ============

export interface ResourceAllocationDetail {
  user_id: string | null;
  name: string;
  role: string;
  position: string;
  fte: number;
}

export interface MonthlyAllocation {
  month: string;
  total_fte: number;
  details: ResourceAllocationDetail[];
}

export interface ProjectAllocationRow {
  project_id: string;
  project_code: string;
  project_name: string;
  category: string;
  allocations: Record<string, MonthlyAllocation>;
}

export interface ProductLineGroup {
  product_line_id: string;
  product_line_name: string;
  projects: ProjectAllocationRow[];
  total_by_month: Record<string, number>;
}

export interface ResourceAllocationMatrix {
  start_month: string;
  end_month: string;
  months: string[];
  product_lines: ProductLineGroup[];
  grand_total_by_month: Record<string, number>;
}

export const getResourceAllocationMatrix = async (
  startMonth: string,
  endMonth: string,
  departmentId?: string
): Promise<ResourceAllocationMatrix> => {
  const params = new URLSearchParams({
    start_month: startMonth,
    end_month: endMonth,
  });
  if (departmentId) params.append('department_id', departmentId);

  const response = await apiClient.get(`/resource-matrix/allocation?${params.toString()}`);
  return response.data;
};

// Pivot Matrix API 
export interface PivotColumn {
  id: string;
  label: string;
  type: string;
  name: string | null;
  total_fte: number;
}

export interface PivotRow {
  user_id: string | null;
  user_name: string;
  position_name: string | null;
  department_name: string | null;
  sub_team_name: string | null;
  total_fte: number;
  total_hours: number;
  allocations: Record<string, number>;
}

export interface PivotMatrixResponse {
  start_month: string;
  end_month: string;
  columns: PivotColumn[];
  rows: PivotRow[];
  grand_total: number;
}

export const getResourcePivotMatrix = async (
  startMonth: string,
  endMonth: string,
  departmentId?: string
): Promise<PivotMatrixResponse> => {
  const params = new URLSearchParams({
    start_month: startMonth,
    end_month: endMonth,
  });
  if (departmentId) params.append('department_id', departmentId);

  const response = await apiClient.get(`/resource-matrix/pivot?${params.toString()}`);
  return response.data;
};

// ============ Internal IO API ============

export interface InternalIOResponse {
  id: string;
  io_number: string;
  name?: string;
  description?: string;
  is_active: boolean;
}

export interface InternalIOCreate {
  io_number: string;
  name?: string;
  description?: string;
}

export interface InternalIOUpdate {
  io_number?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}

export const getInternalIOs = async (params?: { search?: string; is_active?: boolean }): Promise<InternalIOResponse[]> => {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append('search', params.search);
  if (params?.is_active !== undefined) searchParams.append('is_active', String(params.is_active));
  const queryString = searchParams.toString();
  const response = await apiClient.get(`/internal-ios/${queryString ? `?${queryString}` : ''}`);
  return response.data;
};

export const getInternalIO = async (id: string): Promise<InternalIOResponse> => {
  const response = await apiClient.get(`/internal-ios/${id}`);
  return response.data;
};

export const getInternalIOByNumber = async (ioNumber: string): Promise<InternalIOResponse> => {
  const response = await apiClient.get(`/internal-ios/by-number/${ioNumber}`);
  return response.data;
};

export const createInternalIO = async (data: InternalIOCreate): Promise<InternalIOResponse> => {
  const response = await apiClient.post('/internal-ios/', data);
  return response.data;
};

export const updateInternalIO = async (id: string, data: InternalIOUpdate): Promise<InternalIOResponse> => {
  const response = await apiClient.put(`/internal-ios/${id}`, data);
  return response.data;
};

export const deleteInternalIO = async (id: string): Promise<void> => {
  await apiClient.delete(`/internal-ios/${id}`);
};

export const findOrCreateInternalIO = async (data: InternalIOCreate): Promise<InternalIOResponse> => {
  const response = await apiClient.post('/internal-ios/find-or-create/', data);
  return response.data;
};

// ============ Recharge IO API ============

export interface BusinessUnitSimple {
  id: string;
  name: string;
  code: string;
}

export interface RechargeIOResponse {
  id: string;
  io_number: string;
  name?: string;
  description?: string;
  is_active: boolean;
  business_units?: BusinessUnitSimple[];
}

export interface RechargeIOCreate {
  io_number: string;
  name?: string;
  description?: string;
}

export interface RechargeIOUpdate {
  io_number?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}

export const getRechargeIOs = async (params?: { search?: string; is_active?: boolean }): Promise<RechargeIOResponse[]> => {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append('search', params.search);
  if (params?.is_active !== undefined) searchParams.append('is_active', String(params.is_active));
  const queryString = searchParams.toString();
  const response = await apiClient.get(`/recharge-ios/${queryString ? `?${queryString}` : ''}`);
  return response.data;
};

export const getRechargeIO = async (id: string): Promise<RechargeIOResponse> => {
  const response = await apiClient.get(`/recharge-ios/${id}`);
  return response.data;
};

export const getRechargeIOByNumber = async (ioNumber: string): Promise<RechargeIOResponse> => {
  const response = await apiClient.get(`/recharge-ios/by-number/${ioNumber}`);
  return response.data;
};

export const createRechargeIO = async (data: RechargeIOCreate): Promise<RechargeIOResponse> => {
  const response = await apiClient.post('/recharge-ios/', data);
  return response.data;
};

export const updateRechargeIO = async (id: string, data: RechargeIOUpdate): Promise<RechargeIOResponse> => {
  const response = await apiClient.put(`/recharge-ios/${id}`, data);
  return response.data;
};

export const deleteRechargeIO = async (id: string): Promise<void> => {
  await apiClient.delete(`/recharge-ios/${id}`);
};

export const findOrCreateRechargeIO = async (data: RechargeIOCreate): Promise<RechargeIOResponse> => {
  const response = await apiClient.post('/recharge-ios/find-or-create/', data);
  return response.data;
};

export const getRechargeIOsByBusinessUnit = async (buId: string): Promise<RechargeIOResponse[]> => {
  const response = await apiClient.get(`/recharge-ios/by-business-unit/${buId}`);
  return response.data;
};

// ============ AI Summary API ============

export interface UserAISummary {
  summary: string[];
  focus_areas?: string[];
  workload_observations?: string[];
  risk_signals?: string[];
  record_quality_notes?: string[];
  period_start: string;
  period_end: string;
  generated_at: string;
  from_cache?: boolean;
  error?: string;
}

export interface TeamAISummary {
  project_summary: string[];
  member_summary: string[];
  issues: string[];
  analysis?: string[];
  workload_observations?: string[];
  risk_signals?: string[];
  coverage_gaps?: string[];
  record_quality_notes?: string[];
  period_start: string;
  period_end: string;
  generated_at: string;
  from_cache?: boolean;
  error?: string;
}

export const getUserAISummary = async (
  period: 'weekly' | 'monthly' = 'weekly',
  forceRegenerate: boolean = false
): Promise<UserAISummary> => {
  const response = await apiClient.get(
    `/dashboard/ai-summary/user?period=${period}&force_regenerate=${forceRegenerate}`
  );
  return response.data;
};

export const getTeamAISummary = async (
  scope: TeamDashboardScope = 'department',
  period: 'weekly' | 'monthly' = 'weekly',
  forceRegenerate: boolean = false
): Promise<TeamAISummary> => {
  const response = await apiClient.get(
    `/dashboard/ai-summary/team?scope=${scope}&period=${period}&force_regenerate=${forceRegenerate}`
  );
  return response.data;
};

export interface AISummaryHistoryItem {
  id: string;
  period_start: string;
  period_end: string;
  summary: any;
  generated_at: string;
}

export const getUserAISummaryHistory = async (limit: number = 5): Promise<AISummaryHistoryItem[]> => {
  const response = await apiClient.get(`/dashboard/ai-summary/user/history?limit=${limit}`);
  return response.data;
};

export const getTeamAISummaryHistory = async (
  scope: TeamDashboardScope = 'department',
  limit: number = 5
): Promise<AISummaryHistoryItem[]> => {
  const response = await apiClient.get(`/dashboard/ai-summary/team/history?scope=${scope}&limit=${limit}`);
  return response.data;
};

// ============ Weekly Report API ============

export type WeeklyReportScope = 'user' | 'team';
export type WeeklyReportTeamScope = 'department' | 'sub_team';
export type WeeklyReportStatus = 'draft' | 'published';

export interface WeeklyReport {
  id: string;
  scope: WeeklyReportScope;
  team_scope_type: WeeklyReportTeamScope | null;
  scope_id: string;
  target_key: string;
  week_start: string;
  week_end: string;
  week_key: string;
  is_in_progress: boolean;
  status: WeeklyReportStatus;
  title: string | null;
  markdown_body: string;
  source_metadata: Record<string, unknown> | null;
  owner_user_id: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  published_by_user_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReportCurrentResponse {
  scope: WeeklyReportScope;
  team_scope_type: WeeklyReportTeamScope | null;
  scope_id: string;
  target_key: string;
  week_start: string;
  week_end: string;
  week_key: string;
  is_in_progress: boolean;
  report: WeeklyReport | null;
}

export interface WeeklyReportUpsertRequest {
  scope: WeeklyReportScope;
  team_scope_type?: WeeklyReportTeamScope;
  scope_id?: string;
  week_start?: string;
  reference_date?: string;
  status?: WeeklyReportStatus;
  title?: string;
  markdown_body: string;
}

export const getCurrentWeeklyReport = async (params: {
  scope?: WeeklyReportScope;
  team_scope_type?: WeeklyReportTeamScope;
  scope_id?: string;
  reference_date?: string;
}): Promise<WeeklyReportCurrentResponse> => {
  const response = await apiClient.get('/weekly-reports/current', { params });
  return response.data;
};

export const getWeeklyReportHistory = async (params: {
  scope?: WeeklyReportScope;
  team_scope_type?: WeeklyReportTeamScope;
  scope_id?: string;
  limit?: number;
}): Promise<WeeklyReport[]> => {
  const response = await apiClient.get('/weekly-reports/history', { params });
  return response.data.items;
};

export const upsertWeeklyReport = async (
  data: WeeklyReportUpsertRequest
): Promise<WeeklyReport> => {
  const response = await apiClient.put('/weekly-reports', data);
  return response.data;
};

export const deleteWeeklyReport = async (id: string): Promise<{ success: boolean; id: string }> => {
  const response = await apiClient.delete(`/weekly-reports/${id}`);
  return response.data;
};

export interface WeeklyReportLLMSummaryRequest {
  team_scope_type: string;
  scope_id: string;
  week_start?: string;
  save_intermediate?: boolean;
}

export interface SubTeamSummaryResult {
  sub_team_id: string;
  sub_team_name: string;
  summary_markdown: string;
  member_count: number;
}

export interface WeeklyReportLLMSummaryResponse {
  team_summary_markdown: string;
  sub_team_summaries?: SubTeamSummaryResult[];
  personal_report_count: number;
  missing_members: string[];
  scope_description: string;
}

export const generateWeeklyReportLLMSummary = (
  data: WeeklyReportLLMSummaryRequest
): Promise<WeeklyReportLLMSummaryResponse> =>
  apiClient.post('/weekly-reports/llm-summary', data).then((r) => r.data);

// ============ Resource Matrix Drill-down ============

export interface WorklogDetail {
  date: string;
  hours: number;
  project_name: string;
  io_number: string | null;
  description: string | null;
  fte_contribution: number;
}

export const getMatrixDetails = async (
  userId: string,
  month: string,
  ioId: string
): Promise<WorklogDetail[]> => {
  const response = await apiClient.get('/resource-matrix/details', {
    params: { user_id: userId, month, io_id: ioId }
  });
  return response.data;
};

export default apiClient;
