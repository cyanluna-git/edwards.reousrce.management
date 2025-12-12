// Organization Types
export interface BusinessUnit {
    id: string
    name: string
    code: string
    is_active: boolean
}

export interface Department {
    id: number
    business_unit_id: string
    name: string
    code: string
    is_active: boolean
    business_unit?: BusinessUnit
}

export interface SubTeam {
    id: number
    department_id: number
    name: string
    code: string
    is_active: boolean
    department?: Department
}

export interface JobPosition {
    id: string
    name: string
    department_id: number
    sub_team_id?: number
    std_hourly_rate: number
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
}

export interface ProjectType {
    id: string
    name: string
    description?: string
}

export type ProjectStatus = 'WIP' | 'Hold' | 'Completed' | 'Cancelled' | 'Forecast'
export type ProjectComplexity = 'Simple' | 'Derivative' | 'Complex'

export interface ProjectBase {
    program_id: string
    project_type_id: string
    code: string
    name: string
    status: ProjectStatus
    complexity?: ProjectComplexity
    pm_id?: string
    start_date?: string
    end_date?: string
    customer?: string
    product?: string
    description?: string
}

export interface ProjectCreate extends ProjectBase {}

export interface ProjectUpdate {
    program_id?: string
    project_type_id?: string
    code?: string
    name?: string
    status?: ProjectStatus
    complexity?: ProjectComplexity
    pm_id?: string
    start_date?: string
    end_date?: string
    customer?: string
    product?: string
    description?: string
}

export interface Project extends ProjectBase {
    id: string
    program?: Program
    project_type?: ProjectType
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
    project?: Project
    position?: JobPosition
    user?: User
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
    user?: User
    project?: Project
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
