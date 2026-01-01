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
import { useUsers } from '@/hooks/useUsers';
import { useProjectHierarchy, type HierarchyNode } from '@/hooks/useProjectHierarchy';
import {
    Card,
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    StatusBadge,
} from '@/components/ui';
import { ProjectResourceTable, type ResourceRow } from '@/components/resource-plans/ProjectResourceTable';
import { ProjectSummaryTab } from '@/components/resource-plans/ProjectSummaryTab';
import { RoleSummaryTab } from '@/components/resource-plans/RoleSummaryTab';
import { UserHierarchySelect } from '@/components/UserHierarchySelect';

// StatusBadge is now imported from @/components/ui

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

    // Use the same hierarchy API as Projects page for consistent structure
    const { data: hierarchy } = useProjectHierarchy();
    const productProjects = hierarchy?.product_projects || [];

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

    // Filter hierarchy based on showCompleted state
    const filteredHierarchy = useMemo(() => {
        if (showCompleted) return productProjects;

        // Filter out Completed/Cancelled projects from hierarchy
        const filterProjects = (nodes: HierarchyNode[]): HierarchyNode[] => {
            return nodes.map(node => {
                if (node.type === 'project') {
                    if (['Completed', 'Cancelled'].includes(node.status || '')) {
                        return null;
                    }
                    return node;
                }
                const filteredChildren = node.children
                    ? filterProjects(node.children).filter(Boolean) as HierarchyNode[]
                    : [];
                if (filteredChildren.length === 0 && node.type !== 'business_unit') {
                    return null;
                }
                return { ...node, children: filteredChildren };
            }).filter(Boolean) as HierarchyNode[];
        };

        return filterProjects(productProjects);
    }, [productProjects, showCompleted]);

    // Count projects in hierarchy
    const countProjects = (node: HierarchyNode): number => {
        if (node.type === 'project') return 1;
        return (node.children || []).reduce((sum, child) => sum + countProjects(child), 0);
    };

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
                    {/* Tree View - Using same hierarchy as Projects page */}
                    {filteredHierarchy.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            등록된 프로젝트가 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredHierarchy.map((bu: HierarchyNode) => (
                                <Card key={bu.id}>
                                    {/* Business Unit Header */}
                                    <div
                                        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50 border-b"
                                        onClick={() => toggleUnit(bu.id)}
                                    >
                                        <span className="text-lg">{expandedUnits.has(bu.id) ? '▼' : '▶'}</span>
                                        <span className="font-semibold text-base">{bu.name}</span>
                                        <span className="text-xs text-muted-foreground">({bu.code})</span>
                                        <span className="text-sm text-muted-foreground ml-2">
                                            ({countProjects(bu)} 프로젝트)
                                        </span>
                                    </div>

                                    {/* Product Lines under this Business Unit */}
                                    {expandedUnits.has(bu.id) && bu.children && (
                                        <div className="pl-4">
                                            {bu.children.map((pl: HierarchyNode) => (
                                                <div key={pl.id} className="border-b last:border-b-0">
                                                    {/* Product Line Header */}
                                                    <div
                                                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-green-50 bg-slate-50"
                                                        onClick={() => toggleUnit(`pl-${pl.id}`)}
                                                    >
                                                        <span>{expandedUnits.has(`pl-${pl.id}`) ? '▼' : '▶'}</span>
                                                        <span className="font-medium text-sm">{pl.name}</span>
                                                        {pl.code && (
                                                            <span className="text-xs text-muted-foreground">({pl.code})</span>
                                                        )}
                                                        {pl.line_category && (
                                                            <span className={`text-xs px-1.5 py-0.5 rounded ${pl.line_category === 'LEGACY' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {pl.line_category}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">
                                                            {countProjects(pl)} 프로젝트
                                                        </span>
                                                    </div>

                                                    {/* Projects under this Product Line */}
                                                    {expandedUnits.has(`pl-${pl.id}`) && pl.children && (
                                                        <div className="pl-6">
                                                            {pl.children.map((project: HierarchyNode) => (
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
                                    <UserHierarchySelect
                                        users={users}
                                        value={newUserId}
                                        onChange={(userId) => setNewUserId(userId)}
                                        placeholder="TBD (미할당)"
                                    />
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
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
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
            {activeTab === 'project-summary' && (
                <ProjectSummaryTab
                    months={months}
                    projectSummary={projectSummary}
                    projects={projects}
                    worklogSummary={worklogSummary}
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                />
            )}

            {/* Role Summary Tab - By Business Area */}
            {activeTab === 'role-summary' && (
                <RoleSummaryTab
                    months={months}
                    allResourcePlans={allResourcePlans}
                />
            )}
        </div >
    );
};

export default ResourcePlansPage;
