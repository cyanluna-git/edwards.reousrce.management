import React, { useState, useMemo, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { type JobPosition } from '@/types';
import {
    useResourcePlans,
    useCreateResourcePlan,
    useUpdateResourcePlan,
    useDeleteResourcePlan,
    useSummaryByProject,
} from '@/hooks/useResourcePlans';
import { usePermissions } from '@/hooks/usePermissions';
import { getWorklogSummaryByProject, getWorklogSummaryByRole, getProjectRoles, getJobPositionsList, type ProjectRole, WorklogProjectSummary, WorklogRoleSummary } from '@/api/client';
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
import { TbdAssignmentModal } from '@/components/resource-plans/TbdAssignmentModal';
import { UserHierarchySelect } from '@/components/UserHierarchySelect';

// StatusBadge is now imported from @/components/ui

const YEAR_RANGE_SPAN = 3;

// Generate months for the selected year through the next two years.
const generateMonthsForYearRange = (startYear: number) => {
    const months: { year: number; month: number; label: string }[] = [];

    for (let yearOffset = 0; yearOffset < YEAR_RANGE_SPAN; yearOffset++) {
        const year = startYear + yearOffset;
        for (let month = 1; month <= 12; month++) {
            months.push({
                year,
                month,
                label: format(new Date(year, month - 1, 1), 'yy-MMM'),
            });
        }
    }

    return months;
};

export const ResourcePlansPage: React.FC = () => {
    const { t } = useTranslation('resource-plans');
    const { canManageResources } = usePermissions();
    const currentCalendarYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentCalendarYear);
    const months = useMemo(() => generateMonthsForYearRange(selectedYear), [selectedYear]);

    const yearOptions = useMemo(
        () => Array.from({ length: 7 }, (_, index) => currentCalendarYear - 2 + index),
        [currentCalendarYear]
    );

    // Navigation handlers
    const moveYearWindow = (delta: number) => setSelectedYear(prev => prev + delta);
    const resetYearWindow = () => setSelectedYear(currentCalendarYear);

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
    const [isTbdModalOpen, setIsTbdModalOpen] = useState(false); // TBD assignment modal
    const [bulkApplyValue, setBulkApplyValue] = useState<string>('');
    const monthInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const monthGridColumnCount = 6;

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

    // Worklog actual data by role for role summary tab
    const { data: worklogRoleSummary = [] } = useQuery<WorklogRoleSummary[]>({
        queryKey: ['worklog-summary-by-role'],
        queryFn: getWorklogSummaryByRole,
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
        setEditingPlanIds({});
        setBulkApplyValue('');
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
        setBulkApplyValue('');
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
        setEditingPlanIds({});
        setBulkApplyValue('');
    };

    // Handle delete row
    const handleDeleteRow = async (row: ResourceRow) => {
        if (!confirm(t('confirm.deleteRow', { name: row.positionName }))) return;

        for (const data of Object.values(row.monthlyData)) {
            await deletePlan.mutateAsync(data.planId);
        }
    };

    const focusMonthInput = (monthKey: string) => {
        monthInputRefs.current[monthKey]?.focus();
        monthInputRefs.current[monthKey]?.select();
    };

    const updateMonthlyValue = (monthKey: string, value: string) => {
        setMonthlyValues(prev => ({
            ...prev,
            [monthKey]: parseFloat(value) || 0,
        }));
    };

    const applyBulkValueToAllMonths = () => {
        const parsedValue = parseFloat(bulkApplyValue);
        if (Number.isNaN(parsedValue)) return;

        setMonthlyValues(prev => {
            const next = { ...prev };
            months.forEach((month) => {
                next[`${month.year}-${month.month}`] = parsedValue;
            });
            return next;
        });
    };

    const clearAllMonthlyValues = () => {
        setMonthlyValues({});
        setBulkApplyValue('');
    };

    const handleMonthlyInputKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>,
        currentIndex: number
    ) => {
        const nextIndexMap: Record<string, number> = {
            Enter: currentIndex + 1,
            ArrowRight: currentIndex + 1,
            ArrowLeft: currentIndex - 1,
            ArrowDown: currentIndex + 6,
            ArrowUp: currentIndex - 6,
        };
        const targetIndex = nextIndexMap[event.key];

        if (targetIndex === undefined) {
            return;
        }

        event.preventDefault();
        const nextMonth = months[targetIndex];
        if (!nextMonth) {
            return;
        }
        focusMonthInput(`${nextMonth.year}-${nextMonth.month}`);
    };

    const handleMonthlyInputPaste = (
        event: React.ClipboardEvent<HTMLInputElement>,
        startIndex: number
    ) => {
        const pastedText = event.clipboardData.getData('text');
        if (!pastedText.includes('\t') && !pastedText.includes('\n')) {
            return;
        }

        event.preventDefault();
        const rows = pastedText
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .split('\n');

        if (rows.length > 0 && rows[rows.length - 1] === '') {
            rows.pop();
        }

        const startRow = Math.floor(startIndex / monthGridColumnCount);
        const startColumn = startIndex % monthGridColumnCount;
        let hasApplicableCell = false;

        if (rows.length === 0) {
            return;
        }

        setMonthlyValues(prev => {
            const next = { ...prev };
            rows.forEach((rowText, rowOffset) => {
                const columns = rowText.split('\t');

                columns.forEach((cellText, columnOffset) => {
                    const targetColumn = startColumn + columnOffset;
                    if (targetColumn >= monthGridColumnCount) {
                        return;
                    }

                    const targetIndex =
                        (startRow + rowOffset) * monthGridColumnCount + targetColumn;
                    const month = months[targetIndex];
                    if (!month) {
                        return;
                    }

                    hasApplicableCell = true;
                    const parsedValue = parseFloat(cellText.trim());
                    next[`${month.year}-${month.month}`] = Number.isNaN(parsedValue)
                        ? 0
                        : parsedValue;
                });
            });
            return next;
        });

        if (!hasApplicableCell) {
            return;
        }
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <Button
                    onClick={() => setIsTbdModalOpen(true)}
                    variant="outline"
                    title={t('actions.tbdAssignmentTooltip')}
                >
                    {t('actions.tbdAssignment')}
                </Button>
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
                            {t('tabs.detail')}
                        </button>
                        <button
                            className={`px-4 py-2 -mb-px ${activeTab === 'project-summary' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-muted-foreground'}`}
                            onClick={() => setActiveTab('project-summary')}
                        >
                            {t('tabs.projectSummary')}
                        </button>
                        <button
                            className={`px-4 py-2 -mb-px ${activeTab === 'role-summary' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-muted-foreground'}`}
                            onClick={() => setActiveTab('role-summary')}
                        >
                            {t('tabs.roleSummary')}
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
                        {t('actions.includeCompleted')}
                    </label>
                </div>

                {/* Calendar Navigation */}
                <div className="flex items-center gap-1 text-sm pb-1">
                    <button
                        onClick={() => moveYearWindow(-1)}
                        className="px-2 py-1 rounded hover:bg-slate-100 text-slate-600"
                        title={t('calendar.prevYear')}
                    >
                        ◀
                    </button>
                    <button
                        onClick={resetYearWindow}
                        className={`px-3 py-1 rounded ${selectedYear === currentCalendarYear ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-600'}`}
                        title={t('calendar.currentYear')}
                    >
                        📍 {t('calendar.currentYear')}
                    </button>
                    <select
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        aria-label={t('calendar.baseYear')}
                    >
                        {yearOptions.map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => moveYearWindow(1)}
                        className="px-2 py-1 rounded hover:bg-slate-100 text-slate-600"
                        title={t('calendar.nextYear')}
                    >
                        ▶
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
                            {t('hierarchy.noProjects')}
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
                                            ({t('hierarchy.nProjects', { count: countProjects(bu) })})
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
                                                            {t('hierarchy.nProjects', { count: countProjects(pl) })}
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
                                                                            {t('actions.addRow')}
                                                                        </Button>
                                                                    </div>

                                                                    {/* Resource Table for this Project (Lazy Loaded) */}
                                                                    {expandedProjects.has(project.id) && (
                                                                        <ProjectResourceTable
                                                                            projectId={project.id}
                                                                            months={months}
                                                                            onAddMember={canManageResources ? () => handleAddRow(project.id) : undefined}
                                                                            onEditRow={canManageResources ? (row) => handleEditRow(row, project.id) : undefined}
                                                                            onDeleteRow={canManageResources ? (row) => handleDeleteRow(row) : undefined}
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
                    <Dialog
                        open={isAddModalOpen}
                        onOpenChange={(open) => {
                            setIsAddModalOpen(open);
                            if (!open) {
                                setBulkApplyValue('');
                            }
                        }}
                    >
                        <DialogContent className="max-w-4xl">
                            <DialogHeader>
                                <DialogTitle>
                                    {editingRow ? t('form.editTitle', { name: editingRow.positionName }) : t('form.addTitle')}
                                </DialogTitle>
                            </DialogHeader>
                            {/* Role Selectors */}
                            <div className="space-y-4">
                                <div className="space-y-4 border p-4 rounded-md bg-gray-50">
                                    {/* Functional Role Auto-mapped */}

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('form.projectRole')}</label>
                                        <select
                                            className="w-full px-3 py-2 border rounded-md"
                                            value={newProjectRoleId}
                                            onChange={(e) => setNewProjectRoleId(e.target.value)}
                                        >
                                            <option value="">{t('form.selectOption')}</option>
                                            {positions.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-muted-foreground">{t('form.projectRoleHelp')}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('form.user')}</label>
                                    <UserHierarchySelect
                                        users={users}
                                        value={newUserId}
                                        onChange={(userId) => setNewUserId(userId)}
                                        placeholder={t('form.userPlaceholder')}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('form.userHelp')}
                                    </p>
                                </div>

                                {/* Monthly FTE inputs */}
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <label className="text-sm font-medium">{t('form.monthlyFte')}</label>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <input
                                                type="number"
                                                className="w-24 rounded border px-2 py-1 text-sm"
                                                value={bulkApplyValue}
                                                onChange={(e) => setBulkApplyValue(e.target.value)}
                                                min={0}
                                                max={1}
                                                step={0.1}
                                                placeholder={t('form.bulkValuePlaceholder')}
                                            />
                                            <Button type="button" variant="outline" size="sm" onClick={applyBulkValueToAllMonths}>
                                                {t('actions.applyToAllMonths')}
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" onClick={clearAllMonthlyValues}>
                                                {t('actions.clearAllMonths')}
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t('form.monthlyFteHelp')}</p>
                                    <div className="grid grid-cols-6 gap-2">
                                        {months.map((m, index) => {
                                            const key = `${m.year}-${m.month}`;
                                            return (
                                                <div key={key} className="flex flex-col items-center">
                                                    <span className="text-xs text-muted-foreground mb-1">{m.label}</span>
                                                    <input
                                                        ref={(element) => {
                                                            monthInputRefs.current[key] = element;
                                                        }}
                                                        type="number"
                                                        className="w-16 px-2 py-1 border rounded text-center text-sm"
                                                        value={monthlyValues[key] || ''}
                                                        onChange={(e) => updateMonthlyValue(key, e.target.value)}
                                                        onKeyDown={(e) => handleMonthlyInputKeyDown(e, index)}
                                                        onPaste={(e) => handleMonthlyInputPaste(e, index)}
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
                                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>{t('actions.cancel')}</Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={!editingRow && !newJobPositionId}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {t('actions.save')}
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
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                    worklogRoleSummary={worklogRoleSummary}
                />
            )}

            {/* TBD Assignment Modal */}
            <TbdAssignmentModal
                open={isTbdModalOpen}
                onOpenChange={setIsTbdModalOpen}
            />
        </div >
    );
};

export default ResourcePlansPage;
