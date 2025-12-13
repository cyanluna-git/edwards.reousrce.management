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
    work_type?: string;
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
