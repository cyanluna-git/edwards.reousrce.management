import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { type JobPosition } from '@/types';
import {
    useResourcePlans,
    useCreateResourcePlan,
    useDeleteResourcePlan,
    useSummaryByProject,
} from '@/hooks/useResourcePlans';
import { usePermissions } from '@/hooks/usePermissions';
import { getWorklogSummaryByProject, getWorklogSummaryByRole, getProjectRoles, getJobPositionsList, type ProjectRole, WorklogProjectSummary, WorklogRoleSummary } from '@/api/client';
import { useProjects } from '@/hooks/useProjects';
import { useUsers } from '@/hooks/useUsers';
import { useProjectHierarchy, type HierarchyNode } from '@/hooks/useProjectHierarchy';
import {
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    StatusBadge,
} from '@/components/ui';
import { ProjectPlanEditor, type ResourceRow } from '@/components/resource-plans/ProjectPlanEditor';
import { PlanSummaryPanel } from '@/components/resource-plans/PlanSummaryPanel';
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

    // Fullscreen state
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!isFullscreen) return;
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isFullscreen]);

    // Cascade dropdown state — project focus mode
    const [selectedBuId, setSelectedBuId] = useState<string>('');
    const [selectedPlId, setSelectedPlId] = useState<string>('');
    const [focusedProjectId, setFocusedProjectId] = useState<string>(
        () => localStorage.getItem('rp-focused-project') ?? ''
    );

    useEffect(() => {
        localStorage.setItem('rp-focused-project', focusedProjectId);
    }, [focusedProjectId]);

    const handleBuChange = useCallback((buId: string) => {
        setSelectedBuId(buId);
        setSelectedPlId('');
        setFocusedProjectId('');
    }, []);

    const handlePlChange = useCallback((plId: string) => {
        setSelectedPlId(plId);
        setFocusedProjectId('');
    }, []);

    const [selectedProjectId, setSelectedProjectId] = useState<string>(''); // For modal context

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [monthlyValues, setMonthlyValues] = useState<Record<string, number>>({});
    const [showCompleted, setShowCompleted] = useState(false); // Filter completed projects
    const [isTbdModalOpen, setIsTbdModalOpen] = useState(false); // TBD assignment modal
    const [liveRows, setLiveRows] = useState<ResourceRow[]>([]); // Live rows from ProjectPlanEditor
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

    // Fetch all resource plans for summary tabs and for cross-project FTE totals in detail tab
    const { data: allResourcePlans = [] } = useResourcePlans({}, { enabled: activeTab !== 'detail' || !!focusedProjectId });

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

    // Cascade dropdown options derived from filteredHierarchy
    const buOptions = useMemo(() =>
        filteredHierarchy.map(bu => ({ id: bu.id, name: bu.name, code: bu.code ?? '' })),
        [filteredHierarchy]
    );

    const plOptions = useMemo(() => {
        const bus = selectedBuId
            ? filteredHierarchy.filter(bu => bu.id === selectedBuId)
            : filteredHierarchy;
        return bus.flatMap(bu => (bu.children ?? []).map(pl => ({
            id: pl.id, name: pl.name, code: pl.code ?? '', buId: bu.id,
        })));
    }, [filteredHierarchy, selectedBuId]);

    const projectOptions = useMemo(() => {
        const pls = selectedPlId
            ? plOptions.filter(pl => pl.id === selectedPlId)
            : plOptions;
        return pls.flatMap(pl => {
            const plNode = filteredHierarchy
                .flatMap(bu => bu.children ?? [])
                .find(p => p.id === pl.id);
            return (plNode?.children ?? []).map(proj => ({
                id: proj.id, name: proj.name, code: proj.code ?? '', status: proj.status ?? '',
            }));
        });
    }, [filteredHierarchy, plOptions, selectedPlId]);

    const focusedProject = useMemo(() =>
        projectOptions.find(p => p.id === focusedProjectId) ?? null,
        [projectOptions, focusedProjectId]
    );

    // Removed plansByProject logic (moved to ProjectResourceTable)

    // Current month for past/present/future logic
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Mutations
    const createPlan = useCreateResourcePlan();
    const deletePlan = useDeleteResourcePlan();

    // Removed getResourceRowsForProject (moved to ProjectResourceTable)

    // Removed resourceRows legacy memo

    // Removed unused monthlyTotals and getMilestoneForMonth

    // Handle add new row
    const handleAddRow = (projectId: string) => {
        setSelectedProjectId(projectId);
        setMonthlyValues({});
        setBulkApplyValue('');
        setIsAddModalOpen(true);
    };

    // Form state for new row
    const [newProjectRoleId, setNewProjectRoleId] = useState('');
    const [newJobPositionId, setNewJobPositionId] = useState('');
    const [newUserId, setNewUserId] = useState<string | undefined>(undefined);

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
                } else if (jobPositions.length > 0) {
                    // If adding new and no match, default to first (to satisfy Not Null)
                    // Only if currently empty
                    setNewJobPositionId(prev => prev || jobPositions[0].id);
                }
            }
        } else if (!newJobPositionId && jobPositions.length > 0) {
            // Default for new row
            setNewJobPositionId(jobPositions[0].id);
        }
    }, [newUserId, newProjectRoleId, users, positions, jobPositions, newJobPositionId]);

    // Handle save (add new member only; editing is handled inline in ProjectPlanEditor)
    const handleSave = async () => {
        const projectRoleId = newProjectRoleId;
        const jobPositionId = newJobPositionId;

        if (!jobPositionId || !selectedProjectId) return;

        // Create a plan entry for each month that has a value > 0
        for (const m of months) {
            const key = `${m.year}-${m.month}`;
            const hours = monthlyValues[key] || 0;
            if (hours > 0) {
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
        setMonthlyValues({});
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
        <div className={isFullscreen
            ? 'fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden'
            : 'flex flex-col h-full overflow-hidden'
        }>
            {/* Header */}
            <div className="flex justify-between items-center flex-shrink-0 px-4 pt-4 pb-0">
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => setIsTbdModalOpen(true)}
                        variant="outline"
                        title={t('actions.tbdAssignmentTooltip')}
                    >
                        {t('actions.tbdAssignment')}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => setIsFullscreen(prev => !prev)}
                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen
                            ? <Minimize2 className="h-4 w-4 text-slate-600" />
                            : <Maximize2 className="h-4 w-4 text-slate-600" />
                        }
                    </Button>
                </div>
            </div>

            {/* Tabs and Calendar Navigation */}
            <div className="flex justify-between items-center border-b flex-shrink-0 px-4">
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
                <div className="flex flex-col flex-1 min-h-0 px-4 pb-4 pt-4 gap-3">
                {/* Cascade Project Selector */}
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 flex-shrink-0">
                        <select
                            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 min-w-[160px]"
                            value={selectedBuId}
                            onChange={e => handleBuChange(e.target.value)}
                        >
                            <option value="">All BUs</option>
                            {buOptions.map(bu => (
                                <option key={bu.id} value={bu.id}>{bu.name} ({bu.code})</option>
                            ))}
                        </select>

                        <span className="text-slate-400 text-sm">›</span>

                        <select
                            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 min-w-[180px]"
                            value={selectedPlId}
                            onChange={e => handlePlChange(e.target.value)}
                            disabled={plOptions.length === 0}
                        >
                            <option value="">All Product Lines</option>
                            {plOptions.map(pl => (
                                <option key={pl.id} value={pl.id}>{pl.name}</option>
                            ))}
                        </select>

                        <span className="text-slate-400 text-sm">›</span>

                        <select
                            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 min-w-[220px]"
                            value={focusedProjectId}
                            onChange={e => setFocusedProjectId(e.target.value)}
                            disabled={projectOptions.length === 0}
                        >
                            <option value="">Select Project...</option>
                            {projectOptions.map(p => (
                                <option key={p.id} value={p.id}>{p.code} — {p.name} [{p.status}]</option>
                            ))}
                        </select>

                        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer ml-auto">
                            <input
                                type="checkbox"
                                checked={showCompleted}
                                onChange={(e) => setShowCompleted(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            {t('actions.includeCompleted')}
                        </label>
                    </div>

                    {/* Project View */}
                    {!focusedProjectId ? (
                        <div className="flex flex-col items-center justify-center flex-1 text-slate-400 gap-3">
                            <span className="text-4xl">📋</span>
                            <p className="text-base">{t('filter.selectProjectPrompt', 'Select a project to view and edit resource plans.')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Panel - always visible, user-resizable */}
                            <div className="flex-shrink-0">
                                <PlanSummaryPanel rows={liveRows} months={months} allPlans={allResourcePlans} currentProjectId={focusedProjectId} />
                            </div>

                            {/* Project Header */}
                            <div className="flex-shrink-0 flex items-center gap-3 px-1">
                                <span className="font-semibold text-slate-800">
                                    {focusedProject?.code} — {focusedProject?.name}
                                </span>
                                {focusedProject?.status && <StatusBadge status={focusedProject.status} />}
                                {canManageResources && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="ml-auto h-7 text-xs"
                                        onClick={() => handleAddRow(focusedProjectId)}
                                    >
                                        {t('actions.addRow')}
                                    </Button>
                                )}
                            </div>

                            {/* Resource Table - fills remaining space, independent scroll */}
                            <div className="flex-1 min-h-0 overflow-auto border border-slate-200 rounded-lg">
                                <ProjectPlanEditor
                                    projectId={focusedProjectId}
                                    months={months}
                                    onAddMember={canManageResources ? () => handleAddRow(focusedProjectId) : undefined}
                                    onDeleteRow={canManageResources ? (row) => handleDeleteRow(row) : undefined}
                                    onDataChange={setLiveRows}
                                    stickyTopOffset={0}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Add Member Modal */}
            {activeTab === 'detail' && <Dialog
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
                                <DialogTitle>{t('form.addTitle')}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-4 border p-4 rounded-md bg-gray-50">
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
                                    disabled={!newJobPositionId}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {t('actions.save')}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>}

            {/* Project Summary Tab */}
            {activeTab === 'project-summary' && (
                <div className="flex-1 min-h-0 overflow-auto px-4 pb-4">
                    <ProjectSummaryTab
                        months={months}
                        projectSummary={projectSummary}
                        projects={projects}
                        worklogSummary={worklogSummary}
                        currentYear={currentYear}
                        currentMonth={currentMonth}
                    />
                </div>
            )}

            {/* Role Summary Tab - By Business Area */}
            {activeTab === 'role-summary' && (
                <div className="flex-1 min-h-0 overflow-auto px-4 pb-4">
                    <RoleSummaryTab
                        months={months}
                        allResourcePlans={allResourcePlans}
                        currentYear={currentYear}
                        currentMonth={currentMonth}
                        worklogRoleSummary={worklogRoleSummary}
                    />
                </div>
            )}

            {/* TBD Assignment Modal */}
            <TbdAssignmentModal
                open={isTbdModalOpen}
                onOpenChange={setIsTbdModalOpen}
            />
        </div>
    );
};

export default ResourcePlansPage;
