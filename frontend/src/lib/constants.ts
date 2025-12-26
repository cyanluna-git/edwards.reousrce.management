/**
 * Shared constants for the application
 * Centralized location for color mappings and other reusable constants
 */

// ============================================================
// Project/Resource Status Colors
// ============================================================

/**
 * Status colors for project and resource plan badges
 * Used in: ProjectsPage, ResourcePlansPage, ProjectDetailPage
 */
export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    'InProgress': { bg: 'bg-green-100', text: 'text-green-800' },
    'Planned': { bg: 'bg-blue-100', text: 'text-blue-800' },
    'Prospective': { bg: 'bg-purple-100', text: 'text-purple-800' },
    'OnHold': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    'Completed': { bg: 'bg-gray-100', text: 'text-gray-600' },
    'Closed': { bg: 'bg-gray-200', text: 'text-gray-500' },
    'Cancelled': { bg: 'bg-red-100', text: 'text-red-800' },
};

/**
 * Milestone status colors for timeline displays
 * Used in: ProjectDetailPage, MilestoneTimeline
 */
export const MILESTONE_STATUS_COLORS: Record<string, string> = {
    Pending: 'bg-yellow-100 border-yellow-500 text-yellow-700',
    Completed: 'bg-green-100 border-green-500 text-green-700',
    Delayed: 'bg-red-100 border-red-500 text-red-700',
    Upcoming: 'bg-blue-100 border-blue-500 text-blue-700',
    InProgress: 'bg-purple-100 border-purple-500 text-purple-700',
};

// ============================================================
// Dashboard Category Colors
// ============================================================

/**
 * L1 Category colors for dashboard work type visualization
 */
export const L1_CATEGORY_COLORS: Record<string, { color: string; name: string; name_ko: string }> = {
    'ENG': { color: '#3b82f6', name: 'Engineering', name_ko: '엔지니어링' },
    'PRJ': { color: '#f59e0b', name: 'Project Execution', name_ko: '프로젝트 실행' },
    'OPS': { color: '#10b981', name: 'Operations', name_ko: '운영' },
    'QMS': { color: '#ef4444', name: 'Quality & Compliance', name_ko: '품질/규정준수' },
    'KNW': { color: '#8b5cf6', name: 'Knowledge Work', name_ko: '지식업무' },
    'SUP': { color: '#ec4899', name: 'Support & Service', name_ko: '지원/서비스' },
    'ADM': { color: '#64748b', name: 'Administration', name_ko: '행정' },
    'ABS': { color: '#94a3b8', name: 'Absence', name_ko: '부재' },
};

/**
 * Legacy work_type to L1 category mapping
 * Used for backwards compatibility with old worklog data
 */
export const WORK_TYPE_TO_L1: Record<string, string> = {
    'Meeting': 'PRJ',
    'Design': 'ENG',
    'Documentation': 'KNW',
    'Leave': 'ABS',
    'Verification & Validation': 'ENG',
    'Review': 'PRJ',
    'Training': 'KNW',
    'SW Develop': 'ENG',
    'Field/Shopfloor Work': 'OPS',
    'Management': 'PRJ',
    'Self-Study': 'KNW',
    'Email': 'ADM',
    'Customer Support': 'SUP',
    'Research': 'KNW',
    'QA/QC': 'QMS',
    'Administrative work': 'ADM',
    'Safety': 'QMS',
    'Workshop': 'KNW',
    'Compliances': 'QMS',
    'Other': 'ADM',
    'Meeting & Collaboration': 'PRJ',
};

/**
 * L2 Subcategory colors (derived shades within each L1 category)
 */
export const L2_COLORS: Record<string, Record<string, string>> = {
    'ENG': {
        'Design': '#60a5fa',
        'SW Develop': '#3b82f6',
        'Verification & Validation': '#2563eb',
    },
    'PRJ': {
        'Meeting': '#fbbf24',
        'Review': '#f59e0b',
        'Management': '#d97706',
        'Meeting & Collaboration': '#fcd34d',
    },
    'KNW': {
        'Documentation': '#a78bfa',
        'Training': '#8b5cf6',
        'Self-Study': '#7c3aed',
        'Research': '#6d28d9',
        'Workshop': '#c4b5fd',
    },
    'OPS': {
        'Field/Shopfloor Work': '#34d399',
    },
    'QMS': {
        'QA/QC': '#f87171',
        'Safety': '#ef4444',
        'Compliances': '#dc2626',
    },
    'SUP': {
        'Customer Support': '#f472b6',
    },
    'ADM': {
        'Email': '#94a3b8',
        'Administrative work': '#64748b',
        'Other': '#475569',
    },
    'ABS': {
        'Leave': '#cbd5e1',
    },
};
