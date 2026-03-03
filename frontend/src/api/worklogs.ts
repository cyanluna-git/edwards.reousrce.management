/**
 * WorkLogs API Client
 */
import apiClient from './client';
import type {
    WorkLog,
    WorkLogCreate,
    WorkLogUpdate,
    DailySummary,
    CopyWeekRequest
} from '@/types';

export interface WorkLogListParams {
    user_id?: string;
    project_id?: string;
    start_date?: string;
    end_date?: string;
    work_type_category_id?: number;
    skip?: number;
    limit?: number;
}

/**
 * Get list of worklogs with optional filters
 */
export const getWorklogs = async (params: WorkLogListParams = {}): Promise<WorkLog[]> => {
    const response = await apiClient.get('/worklogs', { params });
    return response.data;
};

/**
 * Get a single worklog by ID
 */
export const getWorklog = async (id: number): Promise<WorkLog> => {
    const response = await apiClient.get(`/worklogs/${id}`);
    return response.data;
};

/**
 * Create a new worklog
 */
export const createWorklog = async (data: WorkLogCreate): Promise<WorkLog> => {
    const response = await apiClient.post('/worklogs', data);
    return response.data;
};

/**
 * Update an existing worklog
 */
export const updateWorklog = async (id: number, data: WorkLogUpdate): Promise<WorkLog> => {
    const response = await apiClient.put(`/worklogs/${id}`, data);
    return response.data;
};

/**
 * Delete a worklog
 */
export const deleteWorklog = async (id: number): Promise<void> => {
    await apiClient.delete(`/worklogs/${id}`);
};

/**
 * Copy worklogs from previous week to target week
 */
export const copyWeek = async (data: CopyWeekRequest): Promise<WorkLog[]> => {
    const response = await apiClient.post('/worklogs/copy-week', data);
    return response.data;
};

/**
 * Get daily summary for a user
 */
export const getDailySummary = async (userId: string, date: string): Promise<DailySummary> => {
    const response = await apiClient.get('/worklogs/summary/daily', {
        params: { user_id: userId, date }
    });
    return response.data;
};

/**
 * Frequent selections response
 */
export interface FrequentItem {
    id: string;
    label: string;
    count: number;
}

export interface FrequentSelections {
    work_types: FrequentItem[];
    projects: FrequentItem[];
}

/**
 * Get user's frequently used work types and projects
 */
export const getFrequentSelections = async (limit = 5, days = 90): Promise<FrequentSelections> => {
    const response = await apiClient.get('/worklogs/frequent', {
        params: { limit, days }
    });
    return response.data;
};

/**
 * WorkLog with user info for table display
 */
export interface WorkLogWithUser extends WorkLog {
    user_name?: string;
    user_korean_name?: string;
    department_name?: string;
}

export interface WorkLogTableParams extends WorkLogListParams {
    sub_team_id?: string;
}

/**
 * Get worklogs for table view with user info
 * Admin: sees all worklogs
 * User: sees only their own worklogs
 */
export const getWorklogsTable = async (params: WorkLogTableParams = {}): Promise<WorkLogWithUser[]> => {
    const response = await apiClient.get('/worklogs/table', { params });
    return response.data;
};

/**
 * Download worklogs as CSV with the same filters as the table view
 */
export const downloadWorklogsCsv = async (params: WorkLogTableParams = {}): Promise<void> => {
    const response = await apiClient.get('/worklogs/export/csv', {
        params,
        responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.setAttribute('download', `worklogs_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};
