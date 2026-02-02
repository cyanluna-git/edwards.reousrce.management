/**
 * Hooks for Job Positions CRUD operations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getJobPositionsList,
    createJobPosition,
    updateJobPosition,
    deleteJobPosition,
    JobPositionCreate,
    JobPositionUpdate,
} from '@/api/client';
import type { JobPosition } from '@/types';

const jobPositionKeys = {
    all: ['job-positions'] as const,
    list: (includeInactive: boolean) => [...jobPositionKeys.all, 'list', includeInactive] as const,
};

export function useJobPositionsList(includeInactive = false) {
    return useQuery<JobPosition[], Error>({
        queryKey: jobPositionKeys.list(includeInactive),
        queryFn: () => getJobPositionsList(includeInactive),
        staleTime: 30 * 60 * 1000, // Reference data - cache for 30 minutes
    });
}

export function useCreateJobPosition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: JobPositionCreate) => createJobPosition(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: jobPositionKeys.all });
        },
    });
}

export function useUpdateJobPosition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: JobPositionUpdate }) =>
            updateJobPosition(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: jobPositionKeys.all });
        },
    });
}

export function useDeleteJobPosition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteJobPosition(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: jobPositionKeys.all });
        },
    });
}
