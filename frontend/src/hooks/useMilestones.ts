/**
 * Hooks for Milestone CRUD operations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getMilestones,
    createMilestone,
    updateMilestone,
    deleteMilestone,
} from '@/api/client';
import type { ProjectMilestone, ProjectMilestoneCreate, ProjectMilestoneUpdate } from '@/types';

// Query key factory
const milestoneKeys = {
    all: ['milestones'] as const,
    lists: () => [...milestoneKeys.all, 'list'] as const,
    list: (projectId: string) => [...milestoneKeys.lists(), projectId] as const,
};

/**
 * Hook to fetch milestones for a project
 */
export function useMilestones(projectId: string) {
    return useQuery<ProjectMilestone[], Error>({
        queryKey: milestoneKeys.list(projectId),
        queryFn: () => getMilestones(projectId),
        enabled: !!projectId,
    });
}

/**
 * Hook to create a new milestone
 */
export function useCreateMilestone(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ProjectMilestoneCreate) => createMilestone(projectId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: milestoneKeys.list(projectId) });
        },
    });
}

/**
 * Hook to update an existing milestone
 */
export function useUpdateMilestone(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ milestoneId, data }: { milestoneId: number; data: ProjectMilestoneUpdate }) =>
            updateMilestone(projectId, milestoneId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: milestoneKeys.list(projectId) });
        },
    });
}

/**
 * Hook to delete a milestone
 */
export function useDeleteMilestone(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (milestoneId: number) => deleteMilestone(projectId, milestoneId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: milestoneKeys.list(projectId) });
        },
    });
}
