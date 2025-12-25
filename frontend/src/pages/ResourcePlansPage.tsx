import React, { useState, useMemo } from 'react';
import { format, addMonths, startOfMonth } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
    useResourcePlans,
    useCreateResourcePlan,
    useUpdateResourcePlan,
    useDeleteResourcePlan,
    useSummaryByProject,
} from '@/hooks/useResourcePlans';
import { getWorklogSummaryByProject, getProjectRoles, type ProjectRole, WorklogProjectSummary } from '@/api/client';
import { useProjects } from '@/hooks/useProjects';
import { useProject } from '@/hooks/useProject';
import { useMilestones } from '@/hooks/useMilestones';
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
import { ProjectSelector } from '@/components/ui/ProjectSelector';
import type { ProjectMilestone } from '@/types';

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

    // Selected project (for detail view)
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingRow, setEditingRow] = useState<{ positionId: string; userId?: string; positionName: string } | null>(null);
    const [monthlyValues, setMonthlyValues] = useState<Record<string, number>>({});

    // Data fetching
    const { data: projects = [] } = useProjects();
    const { data: projectDetail } = useProject(selectedProjectId);
    const { data: milestones = [] } = useMilestones(selectedProjectId);
    const { data: positions = [] } = useQuery({
        queryKey: ['project-roles'],
        queryFn: () => getProjectRoles(),
    });
    const { data: users = [] } = useUsers(undefined, true); // Active users only

    // Fetch all plans for selected project across all 12 months
    const { data: allPlans = [], isLoading } = useResourcePlans(
        selectedProjectId ? { project_id: selectedProjectId } : undefined
    );

    // Summary data
    const { data: projectSummary = [] } = useSummaryByProject();

    // Worklog actual data for plan vs actual comparison
    const { data: worklogSummary = [] } = useQuery<WorklogProjectSummary[]>({
        queryKey: ['worklog-summary-by-project'],
        queryFn: getWorklogSummaryByProject,
    });

    // Fetch all resource plans for role-by-business-area analysis
    const { data: allResourcePlans = [] } = useResourcePlans({});

    // Current month for past/present/future logic
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Mutations
    const createPlan = useCreateResourcePlan();
    const updatePlan = useUpdateResourcePlan();
    const deletePlan = useDeleteResourcePlan();

    // Group plans by position+user
    const resourceRows = useMemo(() => {
        if (!selectedProjectId) return [];

        const rowMap: Record<string, {
            positionId: string;
            positionName: string;
            userId?: string;
            userName?: string;
            isTbd: boolean;
            monthlyData: Record<string, { planId: number; hours: number }>;
        }> = {};

        allPlans.forEach(plan => {
            const key = `${plan.position_id}-${plan.user_id || 'TBD'}`;
            if (!rowMap[key]) {
                rowMap[key] = {
                    positionId: plan.position_id,
                    positionName: plan.position_name || plan.position_id,
                    userId: plan.user_id,
                    userName: plan.user_name,
                    isTbd: plan.is_tbd,
                    monthlyData: {},
                };
            }
            const monthKey = `${plan.year}-${plan.month}`;
            rowMap[key].monthlyData[monthKey] = {
                planId: plan.id,
                hours: plan.planned_hours,
            };
        });

        return Object.values(rowMap);
    }, [allPlans, selectedProjectId]);

    // Calculate monthly totals
    const monthlyTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        months.forEach(m => {
            const key = `${m.year}-${m.month}`;
            totals[key] = resourceRows.reduce((sum, row) => {
                return sum + (row.monthlyData[key]?.hours || 0);
            }, 0);
        });
        return totals;
    }, [months, resourceRows]);

    // Find milestone for a month
    const getMilestoneForMonth = (year: number, month: number): ProjectMilestone | undefined => {
        return milestones.find(m => {
            const date = new Date(m.target_date);
            return date.getFullYear() === year && date.getMonth() + 1 === month;
        });
    };

    // Handle add new row
    const handleAddRow = () => {
        setEditingRow(null);
        setMonthlyValues({});
        setIsAddModalOpen(true);
    };

    // Handle edit row
    const handleEditRow = (row: typeof resourceRows[0]) => {
        setEditingRow({
            positionId: row.positionId,
            userId: row.userId,
            positionName: row.positionName,
        });
        // Pre-fill monthly values
        const values: Record<string, number> = {};
        months.forEach(m => {
            const key = `${m.year}-${m.month}`;
            if (row.monthlyData[key]) {
                values[key] = row.monthlyData[key].hours;
            }
        });
        setMonthlyValues(values);
        setIsAddModalOpen(true);
    };

    // Form state for new row
    const [newPositionId, setNewPositionId] = useState('');
    const [newUserId, setNewUserId] = useState<string | undefined>(undefined);

    // Handle save
    const handleSave = async () => {
        const positionId = editingRow?.positionId || newPositionId;
        if (!positionId || !selectedProjectId) return;

        // For each month with a value, create or update plan
        for (const m of months) {
            const key = `${m.year}-${m.month}`;
            const hours = monthlyValues[key] || 0;

            // Find existing plan for this month
            const existingRow = resourceRows.find(
                r => r.positionId === positionId && r.userId === editingRow?.userId
            );
            const existingPlan = existingRow?.monthlyData[key];

            if (hours > 0) {
                if (existingPlan) {
                    // Update
                    await updatePlan.mutateAsync({
                        planId: existingPlan.planId,
                        data: { planned_hours: hours },
                    });
                } else {
                    // Create
                    await createPlan.mutateAsync({
                        project_id: selectedProjectId,
                        year: m.year,
                        month: m.month,
                        position_id: positionId,
                        user_id: editingRow?.userId || newUserId,
                        planned_hours: hours,
                    });
                }
            } else if (existingPlan && hours === 0) {
                // Delete if set to 0
                await deletePlan.mutateAsync(existingPlan.planId);
            }
        }

        setIsAddModalOpen(false);
        setNewPositionId('');
        setNewUserId(undefined);
        setEditingRow(null);
        setMonthlyValues({});
    };

    // Handle delete row
    const handleDeleteRow = async (row: typeof resourceRows[0]) => {
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
                <div className="flex gap-2">
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
                    {/* Project Selector */}
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex gap-4 items-center">
                                <label className="text-sm font-medium">프로젝트 선택:</label>
                                <ProjectSelector
                                    projects={projects}
                                    value={selectedProjectId}
                                    onChange={setSelectedProjectId}
                                    placeholder="프로젝트를 선택하세요"
                                />

                                {selectedProjectId && (
                                    <Button onClick={handleAddRow}>+ 팀원 추가</Button>
                                )}
                            </div>

                            {/* Milestones display */}
                            {selectedProjectId && milestones.length > 0 && (
                                <div className="mt-3 flex gap-4 text-sm">
                                    <span className="text-muted-foreground">마일스톤:</span>
                                    {milestones.filter(m => m.is_key_gate).map(m => (
                                        <span key={m.id} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                            {m.name}: {format(new Date(m.target_date), 'yy-MMM')}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Resource Grid */}
                    {!selectedProjectId ? (
                        <div className="text-center py-12 text-muted-foreground">
                            프로젝트를 선택하면 리소스 계획이 표시됩니다.
                        </div>
                    ) : isLoading ? (
                        <div className="text-center py-8">로딩 중...</div>
                    ) : (
                        <Card>
                            <CardHeader className="py-3">
                                <CardTitle className="text-base">
                                    {projectDetail?.code} - {projectDetail?.name}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        {/* Milestone row */}
                                        <tr className="bg-slate-50">
                                            <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-50 min-w-[180px]">
                                                팀원/포지션
                                            </th>
                                            {months.map(m => {
                                                const milestone = getMilestoneForMonth(m.year, m.month);
                                                return (
                                                    <th
                                                        key={`${m.year}-${m.month}`}
                                                        className={`text-center py-1 px-1 border-b min-w-[60px] ${milestone ? 'bg-blue-50' : ''}`}
                                                    >
                                                        {milestone && (
                                                            <span className="text-xs text-blue-600 block">⚑ {milestone.name}</span>
                                                        )}
                                                    </th>
                                                );
                                            })}
                                            <th className="text-center py-2 px-2 border-b min-w-[80px]">액션</th>
                                        </tr>
                                        {/* Month headers */}
                                        <tr className="bg-slate-100">
                                            <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100"></th>
                                            {months.map(m => (
                                                <th
                                                    key={`header-${m.year}-${m.month}`}
                                                    className="text-center py-2 px-1 border-b text-xs font-medium"
                                                >
                                                    {m.label}
                                                </th>
                                            ))}
                                            <th className="border-b"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resourceRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={months.length + 2} className="text-center py-8 text-muted-foreground">
                                                    등록된 리소스가 없습니다. '+ 팀원 추가' 버튼을 클릭하세요.
                                                </td>
                                            </tr>
                                        ) : (
                                            <>
                                                {resourceRows.map((row) => (
                                                    <tr
                                                        key={`${row.positionId}-${row.userId || 'TBD'}`}
                                                        className={`border-b hover:bg-slate-50 ${row.isTbd ? 'bg-yellow-50' : ''}`}
                                                    >
                                                        <td className={`py-2 px-2 sticky left-0 ${row.isTbd ? 'bg-yellow-50' : 'bg-white'}`}>
                                                            <div>
                                                                <span className="font-medium">
                                                                    {row.isTbd ? `TBD - ${row.positionName}` : row.userName}
                                                                </span>
                                                                {!row.isTbd && (
                                                                    <span className="text-xs text-muted-foreground ml-2">
                                                                        ({row.positionName})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {months.map(m => {
                                                            const key = `${m.year}-${m.month}`;
                                                            const data = row.monthlyData[key];
                                                            return (
                                                                <td key={key} className="text-center py-2 px-1 border-l">
                                                                    {data ? (
                                                                        <span className={data.hours >= 1 ? 'font-medium' : 'text-muted-foreground'}>
                                                                            {data.hours}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-300">-</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="text-center py-2 px-2 border-l">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-xs h-6 px-2"
                                                                onClick={() => handleEditRow(row)}
                                                            >
                                                                수정
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-xs h-6 px-2 text-red-500"
                                                                onClick={() => handleDeleteRow(row)}
                                                            >
                                                                삭제
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {/* Totals row */}
                                                <tr className="bg-green-50 font-medium">
                                                    <td className="py-2 px-2 sticky left-0 bg-green-50">합계</td>
                                                    {months.map(m => {
                                                        const key = `${m.year}-${m.month}`;
                                                        const total = monthlyTotals[key] || 0;
                                                        return (
                                                            <td key={key} className="text-center py-2 px-1 border-l">
                                                                {total > 0 ? Number(total.toFixed(1)) : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="border-l"></td>
                                                </tr>
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Add/Edit Modal */}
                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogContent className="max-w-4xl">
                            <DialogHeader>
                                <DialogTitle>
                                    {editingRow ? `${editingRow.positionName} 수정` : '팀원/포지션 추가'}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                {/* Position and User selector for new row */}
                                {!editingRow && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">프로젝트 역할 *</label>
                                            <select
                                                className="w-full px-3 py-2 border rounded-md"
                                                value={newPositionId}
                                                onChange={(e) => setNewPositionId(e.target.value)}
                                            >
                                                <option value="">선택하세요</option>
                                                {positions.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
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
                                    </>
                                )}

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
                                    disabled={!editingRow && !newPositionId}
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
                                            <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100 min-w-[200px]">포지션</th>
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
                                                const posId = plan.position_id;
                                                const posName = plan.position_name || posId;
                                                const monthKey = `${plan.year}-${plan.month}`;

                                                if (!grouped[bu]) {
                                                    grouped[bu] = {};
                                                }
                                                if (!grouped[bu][posId]) {
                                                    grouped[bu][posId] = {
                                                        id: posId,
                                                        name: posName,
                                                        data: {},
                                                        totalFte: 0
                                                    };
                                                }

                                                grouped[bu][posId].data[monthKey] =
                                                    (grouped[bu][posId].data[monthKey] || 0) + plan.planned_hours;
                                                grouped[bu][posId].totalFte += plan.planned_hours;
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
