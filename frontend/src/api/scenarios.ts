/**
 * Scenarios API Client
 */
import apiClient from './client';
import type {
    ProjectScenario,
    ProjectScenarioCreate,
    ProjectScenarioUpdate,
    ScenarioMilestone,
    ScenarioMilestoneCreate,
    ScenarioMilestoneUpdate,
    ScenarioComparisonResult,
    CopyScenarioRequest,
} from '@/types';

// ============ Project Scenarios ============

/**
 * Get all scenarios for a project
 */
export const getProjectScenarios = async (projectId: string): Promise<ProjectScenario[]> => {
    const response = await apiClient.get(`/projects/${projectId}/scenarios`);
    return response.data;
};

/**
 * Create a new scenario
 */
export const createScenario = async (
    projectId: string,
    data: ProjectScenarioCreate
): Promise<ProjectScenario> => {
    const response = await apiClient.post(`/projects/${projectId}/scenarios`, data);
    return response.data;
};

/**
 * Create baseline scenario from existing project milestones
 */
export const createBaselineFromMilestones = async (
    projectId: string
): Promise<ProjectScenario> => {
    const response = await apiClient.post(`/projects/${projectId}/scenarios/from-milestones`);
    return response.data;
};

/**
 * Get a scenario by ID
 */
export const getScenario = async (scenarioId: number): Promise<ProjectScenario> => {
    const response = await apiClient.get(`/scenarios/${scenarioId}`);
    return response.data;
};

/**
 * Update a scenario
 */
export const updateScenario = async (
    scenarioId: number,
    data: ProjectScenarioUpdate
): Promise<ProjectScenario> => {
    const response = await apiClient.put(`/scenarios/${scenarioId}`, data);
    return response.data;
};

/**
 * Delete a scenario
 */
export const deleteScenario = async (scenarioId: number): Promise<void> => {
    await apiClient.delete(`/scenarios/${scenarioId}`);
};

/**
 * Copy a scenario
 */
export const copyScenario = async (
    scenarioId: number,
    data: CopyScenarioRequest
): Promise<ProjectScenario> => {
    const response = await apiClient.post(`/scenarios/${scenarioId}/copy`, data);
    return response.data;
};

/**
 * Compare two scenarios
 */
export const compareScenarios = async (
    scenario1Id: number,
    scenario2Id: number
): Promise<ScenarioComparisonResult> => {
    const response = await apiClient.get('/scenarios/compare', {
        params: { scenario_1_id: scenario1Id, scenario_2_id: scenario2Id }
    });
    return response.data;
};

// ============ Scenario Milestones ============

/**
 * Add a milestone to a scenario
 */
export const addMilestone = async (
    scenarioId: number,
    data: ScenarioMilestoneCreate
): Promise<ScenarioMilestone> => {
    const response = await apiClient.post(`/scenarios/${scenarioId}/milestones`, data);
    return response.data;
};

/**
 * Update a milestone
 */
export const updateMilestone = async (
    milestoneId: number,
    data: ScenarioMilestoneUpdate
): Promise<ScenarioMilestone> => {
    const response = await apiClient.put(`/milestones/${milestoneId}`, data);
    return response.data;
};

/**
 * Delete a milestone
 */
export const deleteMilestone = async (milestoneId: number): Promise<void> => {
    await apiClient.delete(`/milestones/${milestoneId}`);
};
