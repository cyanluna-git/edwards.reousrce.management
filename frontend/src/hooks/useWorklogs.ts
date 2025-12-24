/**
 * React Query hooks for WorkLogs
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WorkLogCreate, WorkLogUpdate, CopyWeekRequest } from '@/types';
import {
    getWorklogs,
    getWorklog,
    createWorklog,
    updateWorklog,
    deleteWorklog,
    copyWeek,
    getDailySummary,
    WorkLogListParams,
} from '@/api/worklogs';

// Query keys
const WORKLOGS_KEY = 'worklogs';
const WORKLOG_KEY = 'worklog';
const DAILY_SUMMARY_KEY = 'daily-summary';

/**
 * Hook to fetch list of worklogs with optional filters
 */
export function useWorklogs(params: WorkLogListParams = {}) {
    return useQuery({
        queryKey: [WORKLOGS_KEY, params],
        queryFn: () => getWorklogs(params),
    });
}

/**
 * Hook to fetch a single worklog by ID
 */
export function useWorklog(id: number | undefined) {
    return useQuery({
        queryKey: [WORKLOG_KEY, id],
        queryFn: () => getWorklog(id!),
        enabled: !!id,
    });
}

/**
 * Hook to create a new worklog
 */
export function useCreateWorklog() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: WorkLogCreate) => createWorklog(data),
        onSuccess: () => {
            // Invalidate worklog queries to refetch
            queryClient.invalidateQueries({ queryKey: [WORKLOGS_KEY] });
            queryClient.invalidateQueries({ queryKey: [DAILY_SUMMARY_KEY] });
        },
    });
}

/**
 * Hook to update an existing worklog
 */
export function useUpdateWorklog() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: WorkLogUpdate }) =>
            updateWorklog(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: [WORKLOGS_KEY] });
            queryClient.invalidateQueries({ queryKey: [WORKLOG_KEY, variables.id] });
            queryClient.invalidateQueries({ queryKey: [DAILY_SUMMARY_KEY] });
        },
    });
}

/**
 * Hook to delete a worklog
 */
export function useDeleteWorklog() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => deleteWorklog(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [WORKLOGS_KEY] });
            queryClient.invalidateQueries({ queryKey: [DAILY_SUMMARY_KEY] });
        },
    });
}

/**
 * Hook to copy worklogs from previous week
 */
export function useCopyWeek() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CopyWeekRequest) => copyWeek(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [WORKLOGS_KEY] });
            queryClient.invalidateQueries({ queryKey: [DAILY_SUMMARY_KEY] });
        },
    });
}

/**
 * Hook to get daily summary for a user
 */
export function useDailySummary(userId: string | undefined, date: string | undefined) {
    return useQuery({
        queryKey: [DAILY_SUMMARY_KEY, userId, date],
        queryFn: () => getDailySummary(userId!, date!),
        enabled: !!userId && !!date,
    });
}

/**
 * Hook to fetch worklogs for table view with user info
 */
import { getWorklogsTable, WorkLogTableParams } from '@/api/worklogs';

const WORKLOGS_TABLE_KEY = 'worklogs-table';

export function useWorklogsTable(params: WorkLogTableParams & { enabled?: boolean } = {}) {
    const { enabled = true, ...queryParams } = params;
    return useQuery({
        queryKey: [WORKLOGS_TABLE_KEY, queryParams],
        queryFn: () => getWorklogsTable(queryParams),
        enabled,
    });
}
