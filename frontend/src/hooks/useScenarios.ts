/**
 * React Query hooks for Scenarios
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
    ProjectScenarioCreate,
    ProjectScenarioUpdate,
    ScenarioMilestoneCreate,
    ScenarioMilestoneUpdate,
    CopyScenarioRequest,
} from '@/types';
import {
    getProjectScenarios,
    createScenario,
    createBaselineFromMilestones,
    getScenario,
    updateScenario,
    deleteScenario,
    copyScenario,
    compareScenarios,
    addMilestone,
    updateMilestone,
    deleteMilestone,
} from '@/api/scenarios';

// Query keys
const SCENARIOS_KEY = 'scenarios';
const SCENARIO_KEY = 'scenario';
const SCENARIO_COMPARE_KEY = 'scenario-compare';

/**
 * Hook to fetch all scenarios for a project
 */
export function useProjectScenarios(projectId: string | undefined) {
    return useQuery({
        queryKey: [SCENARIOS_KEY, projectId],
        queryFn: () => getProjectScenarios(projectId!),
        enabled: !!projectId,
    });
}

/**
 * Hook to fetch a single scenario by ID
 */
export function useScenario(scenarioId: number | undefined) {
    return useQuery({
        queryKey: [SCENARIO_KEY, scenarioId],
        queryFn: () => getScenario(scenarioId!),
        enabled: !!scenarioId,
    });
}

/**
 * Hook to create a new scenario
 */
export function useCreateScenario() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ projectId, data }: { projectId: string; data: ProjectScenarioCreate }) =>
            createScenario(projectId, data),
        onSuccess: (_, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: [SCENARIOS_KEY, projectId] });
        },
    });
}

/**
 * Hook to create baseline from existing milestones
 */
export function useCreateBaseline() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (projectId: string) => createBaselineFromMilestones(projectId),
        onSuccess: (_, projectId) => {
            queryClient.invalidateQueries({ queryKey: [SCENARIOS_KEY, projectId] });
        },
    });
}

/**
 * Hook to update a scenario
 */
export function useUpdateScenario() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ scenarioId, data }: { scenarioId: number; data: ProjectScenarioUpdate }) =>
            updateScenario(scenarioId, data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: [SCENARIOS_KEY, result.project_id] });
            queryClient.invalidateQueries({ queryKey: [SCENARIO_KEY, result.id] });
        },
    });
}

/**
 * Hook to delete a scenario
 */
export function useDeleteScenario(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (scenarioId: number) => deleteScenario(scenarioId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [SCENARIOS_KEY, projectId] });
        },
    });
}

/**
 * Hook to copy a scenario
 */
export function useCopyScenario() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ scenarioId, data }: { scenarioId: number; data: CopyScenarioRequest }) =>
            copyScenario(scenarioId, data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: [SCENARIOS_KEY, result.project_id] });
        },
    });
}

/**
 * Hook to compare two scenarios
 */
export function useCompareScenarios(scenario1Id: number | undefined, scenario2Id: number | undefined) {
    return useQuery({
        queryKey: [SCENARIO_COMPARE_KEY, scenario1Id, scenario2Id],
        queryFn: () => compareScenarios(scenario1Id!, scenario2Id!),
        enabled: !!scenario1Id && !!scenario2Id,
    });
}

/**
 * Hook to add a milestone to a scenario
 */
export function useAddMilestone() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ scenarioId, data }: { scenarioId: number; data: ScenarioMilestoneCreate }) =>
            addMilestone(scenarioId, data),
        onSuccess: (_, { scenarioId }) => {
            queryClient.invalidateQueries({ queryKey: [SCENARIO_KEY, scenarioId] });
        },
    });
}

/**
 * Hook to update a milestone
 */
export function useUpdateMilestone(scenarioId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ milestoneId, data }: { milestoneId: number; data: ScenarioMilestoneUpdate }) =>
            updateMilestone(milestoneId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [SCENARIO_KEY, scenarioId] });
        },
    });
}

/**
 * Hook to delete a milestone
 */
export function useDeleteMilestone(scenarioId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (milestoneId: number) => deleteMilestone(milestoneId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [SCENARIO_KEY, scenarioId] });
        },
    });
}
