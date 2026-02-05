// Organization Types
export interface BusinessUnit {
    id: string
    name: string
    code: string
    is_active: boolean
}

export interface Division {
    id: string
    name: string
    code: string
    is_active: boolean
}

export interface Department {
    id: string
    division_id?: string  // Parent division
    name: string
    code: string
    is_active: boolean
    division?: Division
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
    division_id?: string  // NEW
    department_id?: string  // Changed: Optional
    sub_team_id?: string
    position_id: string
    primary_business_unit_id?: string  // 주 활동 사업영역
    role: UserRole
    is_active: boolean
    hire_date?: string
    termination_date?: string
    division?: Division  // NEW
    department?: {
        id: string
        name: string
        code?: string
    }
    sub_team?: SubTeam
    position?: JobPosition
    primary_business_unit?: BusinessUnit  // Nested BU
}

export interface UserHistory {
    id: number
    user_id: string
    division_id?: string  // NEW
    department_id?: string  // Changed: Optional
    sub_team_id?: string | number
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
    business_unit_id?: string
    business_unit?: BusinessUnit  // nested relationship
    line_category?: 'PRODUCT' | 'PLATFORM' | 'LEGACY'
    description?: string
}


export type ProjectStatus = 'Prospective' | 'Planned' | 'InProgress' | 'OnHold' | 'Cancelled' | 'Completed'
export type ProjectScale = 'CIP' | 'A&D' | 'Simple' | 'Complex' | 'Platform'

// Internal IO (Internal Order) - for financial tracking
export interface InternalIO {
    id: string
    io_number: string
    name?: string
    description?: string
    business_unit_id?: string  // BU별 분리된 IO
    business_unit?: BusinessUnit
    is_active: boolean
}

export interface InternalIOCreate {
    io_number: string
    name?: string
    description?: string
}

export interface InternalIOUpdate {
    io_number?: string
    name?: string
    description?: string
    is_active?: boolean
}

// Recharge IO - for cost recharging
export interface RechargeIO {
    id: string
    io_number: string
    name?: string
    description?: string
    is_active: boolean
    business_units: BusinessUnit[]  // M:N relationship
}

export interface RechargeIOCreate {
    io_number: string
    name?: string
    description?: string
    business_unit_ids?: string[]  // BU IDs for M:N
}

export interface RechargeIOUpdate {
    io_number?: string
    name?: string
    description?: string
    is_active?: boolean
    business_unit_ids?: string[]  // Update BU mappings
}

export interface ProjectBase {
    program_id: string
    project_type_id: string
    internal_io_id?: string  // FK to internal_ios table
    recharge_io_id?: string  // FK to recharge_ios table
    name: string
    status: ProjectStatus
    scale?: ProjectScale
    category?: 'PRODUCT' | 'FUNCTIONAL' | 'SUPPORT'
    product_line_id?: string
    owner_department_id?: string  // NEW: Functional project owner
    pm_id?: string
    start_month?: string  // YYYY-MM format
    end_month?: string  // YYYY-MM format
    customer?: string
    product?: string
    description?: string
    // Financial Routing (v2.0 - Recharge & Planning System)
    funding_entity_id?: string  // FK to dim_funding_entity
    recharge_status?: 'BILLABLE' | 'NON_BILLABLE' | 'INTERNAL'
    is_capitalizable?: boolean  // CAPEX vs OPEX
    gl_account_code?: string  // General Ledger account
}


export interface ProjectCreate extends ProjectBase { }

export interface ProjectUpdate {
    program_id?: string | null
    project_type_id?: string | null
    internal_io_id?: string | null
    recharge_io_id?: string | null
    name?: string
    status?: ProjectStatus
    scale?: ProjectScale
    category?: 'PRODUCT' | 'FUNCTIONAL' | 'SUPPORT'
    product_line_id?: string | null
    owner_department_id?: string | null
    pm_id?: string | null
    start_month?: string
    end_month?: string
    customer?: string
    product?: string
    description?: string
    // Financial Routing
    funding_entity_id?: string
    recharge_status?: 'BILLABLE' | 'NON_BILLABLE' | 'INTERNAL'
    is_capitalizable?: boolean
    gl_account_code?: string
}

export interface Project extends ProjectBase {
    id: string
    program?: Program
    project_type?: ProjectType
    product_line?: ProductLine
    owner_department?: Department  // Nested department for FUNCTIONAL projects
    internal_io?: InternalIO  // Nested IO info
    recharge_io?: RechargeIO  // Nested recharge IO info
    pm?: User
    recent_activity_score?: number;
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
    position_id?: string  // Legacy: FunctionalRole
    project_role_id?: string  // NEW: ProjectRole
    user_id?: string
    planned_hours: number
    created_by: string
    created_at?: string
    updated_at?: string
    // Nested info from API
    project_name?: string
    project_code?: string
    position_name?: string
    project_role_name?: string  // NEW: ProjectRole name
    user_name?: string
    business_unit_name?: string  // NEW: BU from project's program
    is_tbd: boolean
}

export interface ResourcePlanCreate {
    project_id: string
    year: number
    month: number
    position_id?: string  // Legacy: FunctionalRole
    project_role_id?: string  // NEW: ProjectRole
    user_id?: string
    planned_hours: number
}

export interface ResourcePlanUpdate {
    user_id?: string
    planned_hours?: number
    position_id?: string
    project_role_id?: string
}

export interface ResourcePlanAssign {
    user_id: string
}

// Work Type Categories
export interface WorkTypeCategory {
    id: number
    code: string
    name: string
    name_ko?: string
    description?: string
    level: number
    parent_id?: number
    parent?: WorkTypeCategory
    children?: WorkTypeCategory[]
    applicable_roles?: string
    project_required?: boolean  // NEW: Whether project/product line selection is required
}


export interface WorkLog {
    id: number
    date: string
    user_id: string
    project_id?: string
    product_line_id?: string
    work_type_category_id: number
    hours: number
    description?: string
    is_sudden_work: boolean
    is_business_trip: boolean
    created_at?: string
    updated_at?: string
    project_code?: string
    project_name?: string
    product_line_name?: string
    product_line_code?: string
    user?: User
    project?: Project
    product_line?: ProductLine
    work_type_category?: WorkTypeCategory
}


export interface WorkLogCreate {
    date: string
    user_id: string
    project_id?: string
    product_line_id?: string
    work_type_category_id: number
    hours: number
    description?: string
    is_sudden_work?: boolean
    is_business_trip?: boolean
}


export interface WorkLogUpdate {
    date?: string
    project_id?: string
    product_line_id?: string
    work_type_category_id?: number
    hours?: number
    description?: string
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

export interface WorklogStats {
    date: string
    total_hours: number
    count: number
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
    refresh_token: string;
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

// ============ AI WorkLog Types ============

export interface AIWorklogParseRequest {
    text: string
    user_id: string
    target_date: string
}

export interface AIWorklogEntry {
    project_id: string | null
    project_name: string | null
    work_type_category_id: number | null
    work_type_name: string | null
    description: string
    hours: number
    confidence: number
}

export interface AIWorklogParseResponse {
    entries: AIWorklogEntry[]
    total_hours: number
    warnings: string[]
}

export interface AIHealthResponse {
    status: 'healthy' | 'unhealthy'
    model: string
    message?: string
}
