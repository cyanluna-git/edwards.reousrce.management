/**
 * Hooks for Resource Plan CRUD operations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getResourcePlans,
    getResourcePlan,
    getTbdPositions,
    createResourcePlan,
    updateResourcePlan,
    deleteResourcePlan,
    assignUserToPlan,
    getJobPositions,
    getSummaryByProject,
    getSummaryByPosition,
    ResourcePlanFilters,
    ProjectSummary,
    PositionSummary,
} from '@/api/client';
import type { ResourcePlan, ResourcePlanCreate, ResourcePlanUpdate, ResourcePlanAssign, JobPosition } from '@/types';

// Query key factory
const resourcePlanKeys = {
    all: ['resource-plans'] as const,
    lists: () => [...resourcePlanKeys.all, 'list'] as const,
    list: (filters: ResourcePlanFilters) => [...resourcePlanKeys.lists(), filters] as const,
    tbd: (filters?: Pick<ResourcePlanFilters, 'project_id' | 'year' | 'month'>) => [...resourcePlanKeys.all, 'tbd', filters] as const,
    detail: (id: number) => [...resourcePlanKeys.all, 'detail', id] as const,
    positions: () => ['job-positions'] as const,
    summaryByProject: () => [...resourcePlanKeys.all, 'summary', 'by-project'] as const,
    summaryByPosition: () => [...resourcePlanKeys.all, 'summary', 'by-position'] as const,
};

/**
 * Hook to fetch resource plans with filters
 */
export function useResourcePlans(filters?: ResourcePlanFilters, options?: { enabled?: boolean }) {
    return useQuery<ResourcePlan[], Error>({
        queryKey: resourcePlanKeys.list(filters || {}),
        queryFn: () => getResourcePlans(filters),
        enabled: options?.enabled,
    });
}

/**
 * Hook to fetch a single resource plan
 */
export function useResourcePlan(planId: number) {
    return useQuery<ResourcePlan, Error>({
        queryKey: resourcePlanKeys.detail(planId),
        queryFn: () => getResourcePlan(planId),
        enabled: planId > 0,
    });
}

/**
 * Hook to fetch TBD (unassigned) positions
 */
export function useTbdPositions(filters?: Pick<ResourcePlanFilters, 'project_id' | 'year' | 'month'>) {
    return useQuery<ResourcePlan[], Error>({
        queryKey: resourcePlanKeys.tbd(filters),
        queryFn: () => getTbdPositions(filters),
    });
}

/**
 * Hook to fetch job positions
 */
export function useJobPositions() {
    return useQuery<JobPosition[], Error>({
        queryKey: resourcePlanKeys.positions(),
        queryFn: getJobPositions,
    });
}

/**
 * Hook to create a new resource plan
 */
export function useCreateResourcePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ResourcePlanCreate) => createResourcePlan(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: resourcePlanKeys.all });
        },
    });
}

/**
 * Hook to update a resource plan
 */
export function useUpdateResourcePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ planId, data }: { planId: number; data: ResourcePlanUpdate }) =>
            updateResourcePlan(planId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: resourcePlanKeys.all });
        },
    });
}

/**
 * Hook to delete a resource plan
 */
export function useDeleteResourcePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (planId: number) => deleteResourcePlan(planId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: resourcePlanKeys.all });
        },
    });
}

/**
 * Hook to assign a user to a TBD position
 */
export function useAssignUserToPlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ planId, data }: { planId: number; data: ResourcePlanAssign }) =>
            assignUserToPlan(planId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: resourcePlanKeys.all });
        },
    });
}

/**
 * Hook to fetch summary by project
 */
export function useSummaryByProject() {
    return useQuery<ProjectSummary[], Error>({
        queryKey: resourcePlanKeys.summaryByProject(),
        queryFn: getSummaryByProject,
    });
}

/**
 * Hook to fetch summary by position
 */
export function useSummaryByPosition() {
    return useQuery<PositionSummary[], Error>({
        queryKey: resourcePlanKeys.summaryByPosition(),
        queryFn: getSummaryByPosition,
    });
}
