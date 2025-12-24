// Organization Types
export interface BusinessUnit {
    id: string
    name: string
    code: string
    is_active: boolean
}

export interface Department {
    id: string
    business_unit_id: string
    name: string
    code: string
    is_active: boolean
    business_unit?: BusinessUnit
}

export interface SubTeam {
    id: string
    department_id: string
    name: string
    code: string
    is_active: boolean
    department?: Department
}

export interface JobPosition {
    id: string
    name: string
    department_id?: string
    sub_team_id?: string
    std_hourly_rate?: number
    is_active: boolean
}

// User Types
export type UserRole = 'ADMIN' | 'PM' | 'FM' | 'USER'

export interface User {
    id: string
    email: string
    name: string
    korean_name?: string
    department_id: number
    sub_team_id?: number
    position_id: string
    role: UserRole
    is_active: boolean
    hire_date?: string
    termination_date?: string
    department?: Department
    sub_team?: SubTeam
    position?: JobPosition
}

export interface UserHistory {
    id: number
    user_id: string
    department_id: number
    sub_team_id?: number
    position_id: string
    start_date: string
    end_date?: string
    change_type: 'HIRE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'PROMOTION' | 'RESIGN'
    remarks?: string
}

// Project Types
export interface Program {
    id: string
    name: string
    business_unit_id: string
    description?: string
    is_active: boolean
    business_unit?: BusinessUnit
}

export interface ProjectType {
    id: string
    name: string
    description?: string
}

export interface ProductLine {
    id: string
    name: string
    code: string
    description?: string
}

export type ProjectStatus = 'Prospective' | 'Planned' | 'InProgress' | 'OnHold' | 'Cancelled' | 'Completed'
export type ProjectScale = 'CIP' | 'A&D' | 'Simple' | 'Complex' | 'Platform'

export interface ProjectBase {
    program_id: string
    project_type_id: string
    code: string
    name: string
    status: ProjectStatus
    scale?: ProjectScale
    product_line_id?: string
    pm_id?: string
    start_month?: string  // YYYY-MM format
    end_month?: string  // YYYY-MM format
    customer?: string
    product?: string
    description?: string
}

export interface ProjectCreate extends ProjectBase { }

export interface ProjectUpdate {
    program_id?: string
    project_type_id?: string
    code?: string
    name?: string
    status?: ProjectStatus
    scale?: ProjectScale
    product_line_id?: string
    pm_id?: string
    start_month?: string
    end_month?: string
    customer?: string
    product?: string
    description?: string
}

export interface Project extends ProjectBase {
    id: string
    program?: Program
    project_type?: ProjectType
    product_line?: ProductLine
    pm?: User
}

export interface ProjectMilestone {
    id: number
    project_id: string
    name: string
    type: 'STD_GATE' | 'CUSTOM'
    target_date: string
    actual_date?: string
    status: 'Pending' | 'Completed' | 'Delayed'
    is_key_gate: boolean
    description?: string
    created_at?: string
    updated_at?: string
}

export interface ProjectMilestoneCreate {
    name: string
    type?: 'STD_GATE' | 'CUSTOM'
    target_date: string
    actual_date?: string
    status?: 'Pending' | 'Completed' | 'Delayed'
    is_key_gate?: boolean
    description?: string
}

export interface ProjectMilestoneUpdate {
    name?: string
    type?: 'STD_GATE' | 'CUSTOM'
    target_date?: string
    actual_date?: string
    status?: 'Pending' | 'Completed' | 'Delayed'
    is_key_gate?: boolean
    description?: string
}

// Resource Types
export interface ResourcePlan {
    id: number
    project_id: string
    year: number
    month: number
    position_id: string
    user_id?: string
    planned_hours: number
    created_by: string
    created_at?: string
    updated_at?: string
    // Nested info from API
    project_name?: string
    project_code?: string
    position_name?: string
    user_name?: string
    is_tbd: boolean
}

export interface ResourcePlanCreate {
    project_id: string
    year: number
    month: number
    position_id: string
    user_id?: string
    planned_hours: number
}

export interface ResourcePlanUpdate {
    user_id?: string
    planned_hours?: number
    position_id?: string
}

export interface ResourcePlanAssign {
    user_id: string
}

export interface WorkLog {
    id: number
    date: string
    user_id: string
    project_id: string
    work_type: string
    hours: number
    description?: string
    meeting_type?: string
    is_sudden_work: boolean
    is_business_trip: boolean
    created_at?: string
    updated_at?: string
    project_code?: string
    project_name?: string
    user?: User
    project?: Project
}

export interface WorkLogCreate {
    date: string
    user_id: string
    project_id: string
    work_type: string
    hours: number
    description?: string
    meeting_type?: string
    is_sudden_work?: boolean
    is_business_trip?: boolean
}

export interface WorkLogUpdate {
    date?: string
    project_id?: string
    work_type?: string
    hours?: number
    description?: string
    meeting_type?: string
    is_sudden_work?: boolean
    is_business_trip?: boolean
}

export interface ProjectSummary {
    project_id: string
    project_code: string
    project_name: string
    hours: number
}

export interface DailySummary {
    date: string
    user_id: string
    total_hours: number
    remaining_hours: number
    projects: ProjectSummary[]
}

export interface CopyWeekRequest {
    user_id: string
    target_week_start: string
}

// Common Types
export interface CommonCode {
    id: number
    group_code: string
    code_id: string
    name: string
    description?: string
    sort_order: number
    is_active: boolean
}

export interface Holiday {
    id: number
    date: string
    name: string
    type: 'LEGAL' | 'COMPANY'
    year: number
}

// API Response Types
export interface PaginatedResponse<T> {
    items: T[]
    total: number
    page: number
    page_size: number
}

export interface ApiError {
    detail: string
    status_code: number
}

// Auth Types
export interface Token {
    access_token: string;
    token_type: string;
}

// ============ Scenario Types ============

export interface ScenarioMilestone {
    id: number
    scenario_id: number
    base_milestone_id?: number
    name: string
    type: 'STD_GATE' | 'CUSTOM'
    target_date: string
    actual_date?: string
    status: 'Pending' | 'Completed' | 'Delayed'
    is_key_gate: boolean
    notes?: string
    sort_order: number
    created_at: string
    updated_at: string
}

export interface ScenarioMilestoneCreate {
    name: string
    type?: string
    target_date: string
    actual_date?: string
    status?: string
    is_key_gate?: boolean
    notes?: string
    sort_order?: number
    base_milestone_id?: number
}

export interface ScenarioMilestoneUpdate {
    name?: string
    type?: string
    target_date?: string
    actual_date?: string
    status?: string
    is_key_gate?: boolean
    notes?: string
    sort_order?: number
}

export interface ProjectScenario {
    id: number
    project_id: string
    name: string
    description?: string
    is_active: boolean
    is_baseline: boolean
    created_at: string
    updated_at: string
    milestones: ScenarioMilestone[]
}

export interface ProjectScenarioCreate {
    name: string
    description?: string
    is_active?: boolean
    is_baseline?: boolean
    milestones?: ScenarioMilestoneCreate[]
}

export interface ProjectScenarioUpdate {
    name?: string
    description?: string
    is_active?: boolean
    is_baseline?: boolean
}

export interface MilestoneComparison {
    milestone_name: string
    scenario_1_date?: string
    scenario_2_date?: string
    delta_days?: number
}

export interface ScenarioComparisonResult {
    scenario_1_id: number
    scenario_1_name: string
    scenario_2_id: number
    scenario_2_name: string
    milestone_comparisons: MilestoneComparison[]
    total_delta_days: number
}

export interface CopyScenarioRequest {
    new_name: string
    date_offset_days?: number
}
