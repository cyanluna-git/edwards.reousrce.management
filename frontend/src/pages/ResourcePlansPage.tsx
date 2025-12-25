import React, { useState, useMemo, useEffect } from 'react';
import { format, addMonths, startOfMonth } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { type JobPosition } from '@/types';
import {
    useResourcePlans,
    useCreateResourcePlan,
    useUpdateResourcePlan,
    useDeleteResourcePlan,
    useSummaryByProject,
} from '@/hooks/useResourcePlans';
import { getWorklogSummaryByProject, getProjectRoles, getJobPositionsList, type ProjectRole, WorklogProjectSummary } from '@/api/client';
import { useProjects } from '@/hooks/useProjects';
// Removed unused imports
import { useUsers } from '@/hooks/useUsers';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui';
import { ProjectResourceTable, type ResourceRow } from '@/components/resource-plans/ProjectResourceTable';

// Status color mapping
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    'InProgress': { bg: 'bg-green-100', text: 'text-green-800' },
    'Planned': { bg: 'bg-blue-100', text: 'text-blue-800' },
    'Prospective': { bg: 'bg-purple-100', text: 'text-purple-800' },
    'OnHold': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    'Completed': { bg: 'bg-gray-100', text: 'text-gray-600' },
    'Closed': { bg: 'bg-gray-200', text: 'text-gray-500' },
    'Cancelled': { bg: 'bg-red-100', text: 'text-red-800' },
};

function StatusBadge({ status }: { status: string }) {
    const colors = STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text} border border-opacity-20`}>
            {status}
        </span>
    );
}

// Generate 12 months starting from offset months before current
const generate12Months = (offsetMonths: number = -2) => {
    const months: { year: number; month: number; label: string }[] = [];
    const startDate = addMonths(startOfMonth(new Date()), offsetMonths);

    for (let i = 0; i < 12; i++) {
        const date = addMonths(startDate, i);
        months.push({
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            label: format(date, 'yy-MMM'),
        });
    }
    return months;
};

export const ResourcePlansPage: React.FC = () => {
    // Calendar offset state (default: -2 = start from 2 months ago)
    const [calendarOffset, setCalendarOffset] = useState(-2);
    const months = useMemo(() => generate12Months(calendarOffset), [calendarOffset]);

    // Navigation handlers
    const moveCalendar = (delta: number) => setCalendarOffset(prev => prev + delta);
    const resetCalendar = () => setCalendarOffset(-2);

    // Tab state: 'detail' | 'project-summary' | 'role-summary'
    const [activeTab, setActiveTab] = useState<'detail' | 'project-summary' | 'role-summary'>('detail');

    // Tree view expand state
    const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [selectedProjectId, setSelectedProjectId] = useState<string>(''); // For modal context

    // Toggle functions
    const toggleUnit = (unitId: string) => {
        setExpandedUnits(prev => {
            const newSet = new Set(prev);
            if (newSet.has(unitId)) {
                newSet.delete(unitId);
            } else {
                newSet.add(unitId);
            }
            return newSet;
        });
    };

    const toggleProject = (projectId: string) => {
        setExpandedProjects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) {
                newSet.delete(projectId);
            } else {
                newSet.add(projectId);
            }
            return newSet;
        });
    };

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingRow, setEditingRow] = useState<{ positionId: string; userId?: string; positionName: string } | null>(null);
    const [monthlyValues, setMonthlyValues] = useState<Record<string, number>>({});
    const [editingPlanIds, setEditingPlanIds] = useState<Record<string, number>>({}); // Store plan IDs for editing
    const [showCompleted, setShowCompleted] = useState(false); // Filter completed projects

    // Data fetching
    const { data: projects = [] } = useProjects();
    // Removed unused useProject and useMilestones calls
    const { data: positions = [] } = useQuery<ProjectRole[]>({
        queryKey: ['project-roles'],
        queryFn: () => getProjectRoles(),
    });
    const { data: jobPositions = [] } = useQuery<JobPosition[]>({
        queryKey: ['job-positions'],
        queryFn: () => getJobPositionsList(),
    });
    const { data: users = [] } = useUsers(undefined, true); // Active users only

    // Fetch all resource plans for summary tabs only (Legacy mode for summary)
    const { data: allResourcePlans = [] } = useResourcePlans({}, { enabled: activeTab !== 'detail' });

    // Summary data
    const { data: projectSummary = [] } = useSummaryByProject();

    // Worklog actual data for plan vs actual comparison
    const { data: worklogSummary = [] } = useQuery<WorklogProjectSummary[]>({
        queryKey: ['worklog-summary-by-project'],
        queryFn: getWorklogSummaryByProject,
    });

    // Filter projects based on showCompleted state
    const filteredProjects = useMemo(() => {
        if (showCompleted) return projects;
        return projects.filter(p => !['Completed', 'Cancelled'].includes(p.status || ''));
    }, [projects, showCompleted]);

    // Group projects by BusinessUnit
    const projectsByUnit = useMemo(() => {
        const grouped: Record<string, { unitName: string; projects: typeof projects }> = {};
        filteredProjects.forEach(project => {
            const unitName = project.program?.business_unit?.name || 'Unassigned';
            const unitId = project.program?.business_unit?.id || 'unassigned';
            if (!grouped[unitId]) {
                grouped[unitId] = { unitName, projects: [] };
            }
            grouped[unitId].projects.push(project);
        });
        return grouped;
    }, [filteredProjects]);

    // Removed plansByProject logic (moved to ProjectResourceTable)

    // Current month for past/present/future logic
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Mutations
    const createPlan = useCreateResourcePlan();
    const updatePlan = useUpdateResourcePlan();
    const deletePlan = useDeleteResourcePlan();

    // Removed getResourceRowsForProject (moved to ProjectResourceTable)

    // Removed resourceRows legacy memo

    // Removed unused monthlyTotals and getMilestoneForMonth

    // Handle add new row
    const handleAddRow = (projectId: string) => {
        setSelectedProjectId(projectId);
        setEditingRow(null);
        setMonthlyValues({});
        setOriginalValues(null);
        setIsAddModalOpen(true);
    };

    // Handle edit row
    const handleEditRow = (row: ResourceRow, projectId: string) => {
        setSelectedProjectId(projectId);
        setEditingRow({
            positionId: row.positionId,
            userId: row.userId,
            positionName: row.positionName,
        });
        // Pre-fill monthly values and plan IDs
        const values: Record<string, number> = {};
        const planIds: Record<string, number> = {};
        months.forEach(m => {
            const key = `${m.year}-${m.month}`;
            if (row.monthlyData[key]) {
                values[key] = row.monthlyData[key].hours;
                planIds[key] = row.monthlyData[key].planId;
            }
        });
        setMonthlyValues(values);
        setMonthlyValues(values);
        setEditingPlanIds(planIds);
        setNewProjectRoleId(row.projectRoleId);
        setNewJobPositionId(row.positionId);
        setNewUserId(row.userId);

        // Store original snapshot for optimization
        setOriginalValues({
            projectRoleId: row.projectRoleId,
            jobPositionId: row.positionId,
            userId: row.userId,
            monthlyHours: { ...values },
        });

        setIsAddModalOpen(true);
    };

    // Form state for new row
    const [newProjectRoleId, setNewProjectRoleId] = useState('');
    const [newJobPositionId, setNewJobPositionId] = useState('');
    const [newUserId, setNewUserId] = useState<string | undefined>(undefined);

    // Optimization state
    const [originalValues, setOriginalValues] = useState<{
        projectRoleId: string;
        jobPositionId: string;
        userId: string | undefined;
        monthlyHours: Record<string, number>;
    } | null>(null);

    // Auto-map Functional Role (Job Position) based on User or Project Role
    useEffect(() => {
        // If editing and we have an original value, we might want to preserve it UNLESS user changes something?
        // But user said "Functional Role editing is not needed".
        // Strategy: 
        // 1. If User is selected, ALWAYS use User's Position.
        // 2. If no User, try to match Project Role Name to Job Position Name.
        // 3. Fallback: Keep existing or use first available.

        if (newUserId) {
            const user = users.find(u => u.id === newUserId);
            if (user?.position_id) {
                setNewJobPositionId(user.position_id);
            }
        } else if (newProjectRoleId) {
            // If no user, try to match by name
            const pRole = positions.find(p => p.id === newProjectRoleId);
            if (pRole) {
                const match = jobPositions.find(j => j.name === pRole.name);
                if (match) {
                    setNewJobPositionId(match.id);
                } else if (!editingRow && jobPositions.length > 0) {
                    // If adding new and no match, default to first (to satisfy Not Null)
                    // Only if currently empty
                    setNewJobPositionId(prev => prev || jobPositions[0].id);
                }
            }
        } else if (!editingRow && !newJobPositionId && jobPositions.length > 0) {
            // Default for new row
            setNewJobPositionId(jobPositions[0].id);
        }
    }, [newUserId, newProjectRoleId, users, positions, jobPositions, editingRow]);

    // Handle save
    const handleSave = async () => {
        const projectRoleId = newProjectRoleId;
        const jobPositionId = newJobPositionId;

        if (!jobPositionId || !selectedProjectId) {
            // Basic validation: Job Position is mandatory (DB constraint)
            // If user only selected Project Role, we might need to handle it or show error.
            // For now, assuming UI prevents this or we error out if jobPositionId is empty.
            if (!jobPositionId) return;
        }

        // Check if core identifiers changed
        const isRoleUserChanged = !originalValues ||
            (originalValues.projectRoleId || '') !== (projectRoleId || '') ||
            (originalValues.jobPositionId || '') !== (jobPositionId || '') ||
            originalValues.userId !== newUserId;

        // For each month with a value, create or update plan
        for (const m of months) {
            const key = `${m.year}-${m.month}`;
            const hours = monthlyValues[key] || 0;

            // Determine if we are updating existing plan
            const existingPlanId = editingPlanIds[key];

            if (existingPlanId) {
                if (hours === 0) {
                    // Delete if set to 0
                    await deletePlan.mutateAsync(existingPlanId);
                } else {
                    // Update only if changed
                    const originalHours = originalValues?.monthlyHours[key] || 0;
                    if (isRoleUserChanged || hours !== originalHours) {
                        await updatePlan.mutateAsync({
                            planId: existingPlanId,
                            data: {
                                planned_hours: hours,
                                project_role_id: projectRoleId,
                                position_id: jobPositionId,
                                user_id: newUserId
                            },
                        });
                    }
                }
            } else if (hours > 0) {
                // Create
                await createPlan.mutateAsync({
                    project_id: selectedProjectId,
                    year: m.year,
                    month: m.month,
                    project_role_id: projectRoleId,
                    position_id: jobPositionId,
                    user_id: newUserId,
                    planned_hours: hours,
                });
            }
        }

        setIsAddModalOpen(false);
        setNewProjectRoleId('');
        setNewJobPositionId('');
        setNewUserId(undefined);
        setEditingRow(null);
        setMonthlyValues({});
    };

    // Handle delete row
    const handleDeleteRow = async (row: ResourceRow) => {
        if (!confirm(`"${row.positionName}" 행을 삭제하시겠습니까?`)) return;

        for (const data of Object.values(row.monthlyData)) {
            await deletePlan.mutateAsync(data.planId);
        }
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">리소스 계획</h1>
            </div>

            {/* Tabs and Calendar Navigation */}
            <div className="flex justify-between items-center border-b">
                {/* Tabs */}
                <div className="flex gap-2 items-center">
                    <div className="flex gap-2 mr-4">
                        <button
                            className={`px-4 py-2 -mb-px ${activeTab === 'detail' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-muted-foreground'}`}
                            onClick={() => setActiveTab('detail')}
                        >
                            프로젝트 상세
                        </button>
                        <button
                            className={`px-4 py-2 -mb-px ${activeTab === 'project-summary' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-muted-foreground'}`}
                            onClick={() => setActiveTab('project-summary')}
                        >
                            프로젝트별 집계
                        </button>
                        <button
                            className={`px-4 py-2 -mb-px ${activeTab === 'role-summary' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-muted-foreground'}`}
                            onClick={() => setActiveTab('role-summary')}
                        >
                            롤별 집계
                        </button>
                    </div>
                    {/* Filter Toggle */}
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 border px-3 py-1 rounded bg-slate-50">
                        <input
                            type="checkbox"
                            checked={showCompleted}
                            onChange={(e) => setShowCompleted(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Completed/Cancelled 포함
                    </label>
                </div>

                {/* Calendar Navigation */}
                <div className="flex items-center gap-1 text-sm pb-1">
                    <button
                        onClick={() => moveCalendar(-3)}
                        className="px-2 py-1 rounded hover:bg-slate-100 text-slate-600"
                        title="3개월 이전"
                    >
                        ◀◀
                    </button>
                    <button
                        onClick={() => moveCalendar(-1)}
                        className="px-2 py-1 rounded hover:bg-slate-100 text-slate-600"
                        title="1개월 이전"
                    >
                        ◀
                    </button>
                    <button
                        onClick={resetCalendar}
                        className={`px-3 py-1 rounded ${calendarOffset === -2 ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-600'}`}
                        title="기본 뷰 (오늘 기준)"
                    >
                        📍 오늘
                    </button>
                    <button
                        onClick={() => moveCalendar(1)}
                        className="px-2 py-1 rounded hover:bg-slate-100 text-slate-600"
                        title="1개월 이후"
                    >
                        ▶
                    </button>
                    <button
                        onClick={() => moveCalendar(3)}
                        className="px-2 py-1 rounded hover:bg-slate-100 text-slate-600"
                        title="3개월 이후"
                    >
                        ▶▶
                    </button>
                    <span className="ml-2 text-xs text-slate-400">
                        {months[0]?.label} ~ {months[months.length - 1]?.label}
                    </span>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'detail' && (
                <>
                    {/* Tree View - Grouped by Business Unit */}
                    {/* Tree View - Grouped by Business Unit */}
                    {Object.keys(projectsByUnit).length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            등록된 프로젝트가 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {Object.entries(projectsByUnit).map(([unitId, { unitName, projects: unitProjects }]) => (
                                <Card key={unitId}>
                                    {/* Business Unit Header */}
                                    <div
                                        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50 border-b"
                                        onClick={() => toggleUnit(unitId)}
                                    >
                                        <span className="text-lg">{expandedUnits.has(unitId) ? '▼' : '▶'}</span>
                                        <span className="font-semibold text-base">{unitName}</span>
                                        <span className="text-sm text-muted-foreground ml-2">
                                            ({unitProjects.length} 프로젝트)
                                        </span>
                                    </div>

                                    {/* Projects under this Business Unit */}
                                    {expandedUnits.has(unitId) && (
                                        <div className="pl-4">
                                            {unitProjects.map(project => (
                                                <div key={project.id} className="border-b last:border-b-0">
                                                    {/* Project Header */}
                                                    <div
                                                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50"
                                                        onClick={() => toggleProject(project.id)}
                                                    >
                                                        <span>{expandedProjects.has(project.id) ? '▼' : '▶'}</span>
                                                        <span className="font-medium text-sm">
                                                            {project.code} - {project.name}
                                                        </span>
                                                        <StatusBadge status={project.status || 'Unknown'} />
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="ml-auto h-6 text-xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAddRow(project.id);
                                                            }}
                                                        >
                                                            + 팀원 추가
                                                        </Button>
                                                    </div>

                                                    {/* Resource Table for this Project (Lazy Loaded) */}
                                                    {expandedProjects.has(project.id) && (
                                                        <ProjectResourceTable
                                                            projectId={project.id}
                                                            months={months}
                                                            onAddMember={() => handleAddRow(project.id)}
                                                            onEditRow={(row) => handleEditRow(row, project.id)}
                                                            onDeleteRow={(row) => handleDeleteRow(row)}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Add/Edit Modal */}
                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogContent className="max-w-4xl">
                            <DialogHeader>
                                <DialogTitle>
                                    {editingRow ? `${editingRow.positionName} 수정` : '팀원/포지션 추가'}
                                </DialogTitle>
                            </DialogHeader>
                            {/* Role Selectors */}
                            <div className="space-y-4">
                                <div className="space-y-4 border p-4 rounded-md bg-gray-50">
                                    {/* Functional Role Auto-mapped */}

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Project Role (프로젝트 역할)</label>
                                        <select
                                            className="w-full px-3 py-2 border rounded-md"
                                            value={newProjectRoleId}
                                            onChange={(e) => setNewProjectRoleId(e.target.value)}
                                        >
                                            <option value="">선택하세요 (옵션)</option>
                                            {positions.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-muted-foreground">프로젝트 내 수행 역할을 선택해주세요.</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">담당자 (선택사항)</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={newUserId || ''}
                                        onChange={(e) => setNewUserId(e.target.value || undefined)}
                                    >
                                        <option value="">TBD (미할당)</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.korean_name || u.name} ({u.email})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground">
                                        담당자를 선택하지 않으면 TBD(미할당) 포지션으로 생성됩니다.
                                    </p>
                                </div>

                                {/* Monthly FTE inputs */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">월별 FTE 배분 (0.1 ~ 1.0)</label>
                                    <div className="grid grid-cols-6 gap-2">
                                        {months.map(m => {
                                            const key = `${m.year}-${m.month}`;
                                            return (
                                                <div key={key} className="flex flex-col items-center">
                                                    <span className="text-xs text-muted-foreground mb-1">{m.label}</span>
                                                    <input
                                                        type="number"
                                                        className="w-16 px-2 py-1 border rounded text-center text-sm"
                                                        value={monthlyValues[key] || ''}
                                                        onChange={(e) => setMonthlyValues(prev => ({
                                                            ...prev,
                                                            [key]: parseFloat(e.target.value) || 0,
                                                        }))}
                                                        min={0}
                                                        max={1}
                                                        step={0.1}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>취소</Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={!editingRow && !newJobPositionId}
                                >
                                    저장
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )
            }

            {/* Project Summary Tab */}
            {
                activeTab === 'project-summary' && (
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between">
                            <CardTitle>프로젝트별 리소스 집계</CardTitle>
                            <div className="text-xs bg-slate-50 rounded-md px-3 py-2 border">
                                <div className="font-medium mb-1">📋 표시 형식: 계획/실적</div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
                                    <span><span className="text-blue-600">●</span> 과거</span>
                                    <span><span className="text-orange-600">●</span> 현재</span>
                                    <span><span className="text-slate-400">●</span> 미래(계획만)</span>
                                    <span><span className="text-red-600">●</span> 초과</span>
                                    <span><span className="text-green-600">●</span> 여유</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            {projectSummary.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    등록된 리소스 계획이 없습니다.
                                </div>
                            ) : (
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100 min-w-[300px]">프로젝트</th>
                                            {months.map(m => (
                                                <th key={`${m.year}-${m.month}`} className="text-center py-2 px-1 border-b text-xs font-medium min-w-[60px]">
                                                    {m.label}
                                                </th>
                                            ))}
                                            <th className="text-center py-2 px-1 border-b text-xs font-medium min-w-[60px]">합계</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            // Build worklog map: project_id -> { year-month -> fte }
                                            const worklogMap: Record<string, Record<string, number>> = {};
                                            worklogSummary.forEach(w => {
                                                if (!worklogMap[w.project_id]) {
                                                    worklogMap[w.project_id] = {};
                                                }
                                                worklogMap[w.project_id][`${w.year}-${w.month}`] = w.total_fte;
                                            });

                                            // Group by project with business unit info
                                            type ProjectData = {
                                                id: string;
                                                code: string;
                                                name: string;
                                                businessUnit: string;
                                                planData: Record<string, number>;
                                                actualData: Record<string, number>;
                                                totalFte: number;
                                            };
                                            const projectMap: Record<string, ProjectData> = {};

                                            projectSummary.forEach(s => {
                                                if (!projectMap[s.project_id]) {
                                                    const proj = projects.find(p => p.id === s.project_id);
                                                    const buName = proj?.program?.business_unit?.name || 'Others';

                                                    projectMap[s.project_id] = {
                                                        id: s.project_id,
                                                        code: s.project_code,
                                                        name: s.project_name,
                                                        businessUnit: buName,
                                                        planData: {},
                                                        actualData: worklogMap[s.project_id] || {},
                                                        totalFte: 0
                                                    };
                                                }
                                                projectMap[s.project_id].planData[`${s.year}-${s.month}`] = s.total_hours;
                                                projectMap[s.project_id].totalFte += s.total_hours;
                                            });

                                            // Group by business unit
                                            const businessAreaOrder = ['Integrated System', 'Abatement', 'ACM', 'Others'];
                                            const grouped: Record<string, ProjectData[]> = {};

                                            Object.values(projectMap).forEach(proj => {
                                                const bu = proj.businessUnit;
                                                if (!grouped[bu]) {
                                                    grouped[bu] = [];
                                                }
                                                grouped[bu].push(proj);
                                            });

                                            // Sort each group by totalFte descending
                                            Object.keys(grouped).forEach(bu => {
                                                grouped[bu].sort((a, b) => b.totalFte - a.totalFte);
                                            });

                                            // Helper: determine time period (past/current/future)
                                            const getTimePeriod = (year: number, month: number) => {
                                                if (year < currentYear || (year === currentYear && month < currentMonth)) {
                                                    return 'past';
                                                } else if (year === currentYear && month === currentMonth) {
                                                    return 'current';
                                                } else {
                                                    return 'future';
                                                }
                                            };

                                            // Helper: render cell based on period
                                            const renderCell = (plan: number, actual: number, period: 'past' | 'current' | 'future') => {
                                                if (period === 'future') {
                                                    // Future: show plan only (gray)
                                                    return (
                                                        <span className="text-slate-400">
                                                            {plan > 0 ? Number(plan.toFixed(1)) : '-'}
                                                        </span>
                                                    );
                                                } else if (period === 'current') {
                                                    // Current: show plan/actual (orange)
                                                    if (plan === 0 && actual === 0) return <span>-</span>;
                                                    return (
                                                        <span className="text-orange-600 font-medium">
                                                            {Number(plan.toFixed(1))}/{Number(actual.toFixed(1))}
                                                        </span>
                                                    );
                                                } else {
                                                    // Past: show plan/actual with color coding
                                                    if (actual === 0 && plan === 0) {
                                                        return <span>-</span>;
                                                    }
                                                    const diff = actual - plan;
                                                    let colorClass = 'text-blue-600'; // Default
                                                    if (plan > 0 && actual > 0) {
                                                        if (diff > 0.1) colorClass = 'text-red-600'; // Over (actual > plan)
                                                        else if (diff < -0.1) colorClass = 'text-green-600'; // Under (actual < plan)
                                                    }
                                                    const planDisplay = plan > 0 ? Number(plan.toFixed(1)) : '-';
                                                    const actualDisplay = actual > 0 ? Number(actual.toFixed(1)) : '-';
                                                    return (
                                                        <span className={colorClass}>
                                                            {planDisplay}/{actualDisplay}
                                                        </span>
                                                    );
                                                }
                                            };

                                            // Render by business area
                                            return businessAreaOrder
                                                .filter(area => grouped[area]?.length > 0)
                                                .map(area => {
                                                    const areaProjects = grouped[area];
                                                    const areaTotal = areaProjects.reduce((sum, p) => sum + p.totalFte, 0);

                                                    return (
                                                        <React.Fragment key={area}>
                                                            {/* Business Area Header */}
                                                            <tr className="bg-blue-50 border-t-2 border-blue-200">
                                                                <td className="py-2 px-2 sticky left-0 bg-blue-50 font-semibold text-blue-800">
                                                                    📁 {area} ({areaProjects.length}개 프로젝트)
                                                                </td>
                                                                {months.map(m => {
                                                                    const key = `${m.year}-${m.month}`;
                                                                    const monthTotal = areaProjects.reduce(
                                                                        (sum, p) => sum + (p.planData[key] || 0), 0
                                                                    );
                                                                    return (
                                                                        <td key={key} className="text-center py-2 px-1 border-l font-medium text-blue-700">
                                                                            {monthTotal > 0 ? Number(monthTotal.toFixed(1)) : '-'}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="text-center py-2 px-1 border-l font-bold text-blue-800">
                                                                    {Number(areaTotal.toFixed(1))}
                                                                </td>
                                                            </tr>
                                                            {/* Projects in this area */}
                                                            {areaProjects.map(proj => (
                                                                <tr key={proj.id} className="border-b hover:bg-slate-50">
                                                                    <td className="py-1.5 px-4 sticky left-0 bg-white text-sm">
                                                                        {proj.code} - {proj.name}
                                                                    </td>
                                                                    {months.map(m => {
                                                                        const key = `${m.year}-${m.month}`;
                                                                        const plan = proj.planData[key] || 0;
                                                                        const actual = proj.actualData[key] || 0;
                                                                        const period = getTimePeriod(m.year, m.month);
                                                                        return (
                                                                            <td key={key} className="text-center py-1.5 px-1 border-l text-xs">
                                                                                {renderCell(plan, actual, period)}
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="text-center py-1.5 px-1 border-l font-medium">
                                                                        {Number(proj.totalFte.toFixed(1))}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    );
                                                });
                                        })()}
                                        <tr className="bg-green-50 font-bold border-t-2 border-green-300">
                                            <td className="py-2 px-2 sticky left-0 bg-green-50">🔢 전체 합계</td>
                                            {months.map(m => {
                                                const key = `${m.year}-${m.month}`;
                                                const total = projectSummary
                                                    .filter(s => s.year === m.year && s.month === m.month)
                                                    .reduce((sum, s) => sum + s.total_hours, 0);
                                                return (
                                                    <td key={key} className="text-center py-2 px-1 border-l">
                                                        {total > 0 ? Number(total.toFixed(1)) : '-'}
                                                    </td>
                                                );
                                            })}
                                            <td className="text-center py-2 px-1 border-l">
                                                {Number(projectSummary.reduce((sum, s) => sum + s.total_hours, 0).toFixed(1))}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>
                )
            }

            {/* Role Summary Tab - By Business Area */}
            {
                activeTab === 'role-summary' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>롤별 리소스 집계 (사업영역별)</CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            {allResourcePlans.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    등록된 리소스 계획이 없습니다.
                                </div>
                            ) : (
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100 min-w-[200px]">프로젝트 역할</th>
                                            {months.map(m => (
                                                <th key={`${m.year}-${m.month}`} className="text-center py-2 px-1 border-b text-xs font-medium min-w-[60px]">
                                                    {m.label}
                                                </th>
                                            ))}
                                            <th className="text-center py-2 px-1 border-b text-xs font-medium min-w-[60px]">합계</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            // Build project -> business unit mapping
                                            const projectBuMap: Record<string, string> = {};
                                            projects.forEach(p => {
                                                projectBuMap[p.id] = p.program?.business_unit?.name || 'Others';
                                            });

                                            // Group resource plans by: business_unit -> position -> month
                                            type PositionData = {
                                                id: string;
                                                name: string;
                                                data: Record<string, number>;
                                                totalFte: number;
                                            };
                                            type BusinessAreaData = Record<string, PositionData>;

                                            const grouped: Record<string, BusinessAreaData> = {};

                                            allResourcePlans.forEach(plan => {
                                                const bu = projectBuMap[plan.project_id] || 'Others';
                                                // Prefer Project Role, fallback to Position (Functional Role)
                                                const roleId = plan.project_role_id
                                                    ? String(plan.project_role_id)
                                                    : (plan.position_id ? String(plan.position_id) : 'unknown');
                                                const roleName = plan.project_role_name || plan.position_name || roleId;
                                                const monthKey = `${plan.year}-${plan.month}`;

                                                if (!grouped[bu]) {
                                                    grouped[bu] = {};
                                                }
                                                if (!grouped[bu][roleId]) {
                                                    grouped[bu][roleId] = {
                                                        id: roleId,
                                                        name: roleName,
                                                        data: {},
                                                        totalFte: 0
                                                    };
                                                }

                                                grouped[bu][roleId].data[monthKey] =
                                                    (grouped[bu][roleId].data[monthKey] || 0) + plan.planned_hours;
                                                grouped[bu][roleId].totalFte += plan.planned_hours;
                                            });

                                            // Render by business area
                                            const businessAreaOrder = ['Integrated System', 'Abatement', 'ACM', 'Others'];

                                            return businessAreaOrder
                                                .filter(area => grouped[area] && Object.keys(grouped[area]).length > 0)
                                                .map(area => {
                                                    const areaPositions = Object.values(grouped[area])
                                                        .sort((a, b) => b.totalFte - a.totalFte);
                                                    const areaTotal = areaPositions.reduce((sum, p) => sum + p.totalFte, 0);

                                                    return (
                                                        <React.Fragment key={area}>
                                                            {/* Business Area Header */}
                                                            <tr className="bg-purple-50 border-t-2 border-purple-200">
                                                                <td className="py-2 px-2 sticky left-0 bg-purple-50 font-semibold text-purple-800">
                                                                    📁 {area} ({areaPositions.length}개 포지션)
                                                                </td>
                                                                {months.map(m => {
                                                                    const key = `${m.year}-${m.month}`;
                                                                    const monthTotal = areaPositions.reduce(
                                                                        (sum, p) => sum + (p.data[key] || 0), 0
                                                                    );
                                                                    return (
                                                                        <td key={key} className="text-center py-2 px-1 border-l font-medium text-purple-700">
                                                                            {monthTotal > 0 ? Number(monthTotal.toFixed(1)) : '-'}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="text-center py-2 px-1 border-l font-bold text-purple-800">
                                                                    {Number(areaTotal.toFixed(1))}
                                                                </td>
                                                            </tr>
                                                            {/* Positions in this area */}
                                                            {areaPositions.map(pos => (
                                                                <tr key={`${area}-${pos.id}`} className="border-b hover:bg-slate-50">
                                                                    <td className="py-1.5 px-4 sticky left-0 bg-white text-sm">
                                                                        {pos.name}
                                                                    </td>
                                                                    {months.map(m => {
                                                                        const key = `${m.year}-${m.month}`;
                                                                        const val = pos.data[key] || 0;
                                                                        return (
                                                                            <td key={key} className="text-center py-1.5 px-1 border-l">
                                                                                {val > 0 ? Number(val.toFixed(1)) : '-'}
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="text-center py-1.5 px-1 border-l font-medium">
                                                                        {Number(pos.totalFte.toFixed(1))}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    );
                                                });
                                        })()}
                                        <tr className="bg-green-50 font-bold border-t-2 border-green-300">
                                            <td className="py-2 px-2 sticky left-0 bg-green-50">🔢 전체 합계</td>
                                            {months.map(m => {
                                                const key = `${m.year}-${m.month}`;
                                                const total = allResourcePlans
                                                    .filter(p => p.year === m.year && p.month === m.month)
                                                    .reduce((sum, p) => sum + p.planned_hours, 0);
                                                return (
                                                    <td key={key} className="text-center py-2 px-1 border-l">
                                                        {total > 0 ? Number(total.toFixed(1)) : '-'}
                                                    </td>
                                                );
                                            })}
                                            <td className="text-center py-2 px-1 border-l">
                                                {Number(allResourcePlans.reduce((sum, p) => sum + p.planned_hours, 0).toFixed(1))}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>
                )
            }
        </div >
    );
};

export default ResourcePlansPage;
