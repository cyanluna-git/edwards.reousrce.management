import React, { useState, useMemo } from 'react';
import { format, addMonths, startOfMonth } from 'date-fns';
import {
    useResourcePlans,
    useCreateResourcePlan,
    useUpdateResourcePlan,
    useDeleteResourcePlan,
    useJobPositions,
    useSummaryByProject,
    useSummaryByPosition,
} from '@/hooks/useResourcePlans';
import { useProjects } from '@/hooks/useProjects';
import { useProject } from '@/hooks/useProject';
import { useMilestones } from '@/hooks/useMilestones';
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
import type { Project, ProjectMilestone } from '@/types';

// Generate 12 months starting from 2 months ago
const generate12Months = () => {
    const months: { year: number; month: number; label: string }[] = [];
    const startDate = addMonths(startOfMonth(new Date()), -2);

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
    const months = useMemo(() => generate12Months(), []);

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
    const { data: positions = [] } = useJobPositions();

    // Fetch all plans for selected project across all 12 months
    const { data: allPlans = [], isLoading } = useResourcePlans(
        selectedProjectId ? { project_id: selectedProjectId } : undefined
    );

    // Summary data
    const { data: projectSummary = [] } = useSummaryByProject();
    const { data: positionSummary = [] } = useSummaryByPosition();

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
                        user_id: editingRow?.userId,
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

            {/* Tabs */}
            <div className="flex gap-2 border-b">
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

            {/* Tab Content */}
            {activeTab === 'detail' && (
                <>
                    {/* Project Selector */}
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex gap-4 items-center">
                                <label className="text-sm font-medium">프로젝트 선택:</label>
                                <select
                                    className="px-3 py-2 border rounded-md min-w-[350px]"
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                >
                                    <option value="">프로젝트를 선택하세요</option>
                                    {projects.map((p: Project) => (
                                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                    ))}
                                </select>

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
                                                                {total > 0 ? total : '-'}
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
                                {/* Position selector for new row */}
                                {!editingRow && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">포지션/역할 *</label>
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
                                        <p className="text-xs text-muted-foreground">
                                            * 담당자 없이 저장하면 TBD(미할당) 포지션으로 생성됩니다.
                                        </p>
                                    </div>
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
            )}

            {/* Project Summary Tab */}
            {activeTab === 'project-summary' && (
                <Card>
                    <CardHeader>
                        <CardTitle>프로젝트별 리소스 집계</CardTitle>
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
                                        <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100 min-w-[200px]">프로젝트</th>
                                        {months.map(m => (
                                            <th key={`${m.year}-${m.month}`} className="text-center py-2 px-1 border-b text-xs font-medium min-w-[60px]">
                                                {m.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        // Group by project
                                        const projectMap: Record<string, { code: string; name: string; data: Record<string, number> }> = {};
                                        projectSummary.forEach(s => {
                                            if (!projectMap[s.project_id]) {
                                                projectMap[s.project_id] = { code: s.project_code, name: s.project_name, data: {} };
                                            }
                                            projectMap[s.project_id].data[`${s.year}-${s.month}`] = s.total_hours;
                                        });
                                        return Object.entries(projectMap).map(([id, proj]) => (
                                            <tr key={id} className="border-b hover:bg-slate-50">
                                                <td className="py-2 px-2 sticky left-0 bg-white">{proj.code} - {proj.name}</td>
                                                {months.map(m => {
                                                    const key = `${m.year}-${m.month}`;
                                                    const val = proj.data[key] || 0;
                                                    return (
                                                        <td key={key} className="text-center py-2 px-1 border-l">
                                                            {val > 0 ? val : '-'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ));
                                    })()}
                                    <tr className="bg-green-50 font-medium">
                                        <td className="py-2 px-2 sticky left-0 bg-green-50">합계</td>
                                        {months.map(m => {
                                            const key = `${m.year}-${m.month}`;
                                            const total = projectSummary
                                                .filter(s => s.year === m.year && s.month === m.month)
                                                .reduce((sum, s) => sum + s.total_hours, 0);
                                            return (
                                                <td key={key} className="text-center py-2 px-1 border-l">
                                                    {total > 0 ? total : '-'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Role Summary Tab */}
            {activeTab === 'role-summary' && (
                <Card>
                    <CardHeader>
                        <CardTitle>롤별 리소스 집계</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        {positionSummary.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                등록된 리소스 계획이 없습니다.
                            </div>
                        ) : (
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100 min-w-[150px]">포지션</th>
                                        {months.map(m => (
                                            <th key={`${m.year}-${m.month}`} className="text-center py-2 px-1 border-b text-xs font-medium min-w-[60px]">
                                                {m.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        // Group by position
                                        const posMap: Record<string, { name: string; data: Record<string, number> }> = {};
                                        positionSummary.forEach(s => {
                                            if (!posMap[s.position_id]) {
                                                posMap[s.position_id] = { name: s.position_name, data: {} };
                                            }
                                            posMap[s.position_id].data[`${s.year}-${s.month}`] = s.total_hours;
                                        });
                                        return Object.entries(posMap).map(([id, pos]) => (
                                            <tr key={id} className="border-b hover:bg-slate-50">
                                                <td className="py-2 px-2 sticky left-0 bg-white">{pos.name}</td>
                                                {months.map(m => {
                                                    const key = `${m.year}-${m.month}`;
                                                    const val = pos.data[key] || 0;
                                                    return (
                                                        <td key={key} className="text-center py-2 px-1 border-l">
                                                            {val > 0 ? val : '-'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ));
                                    })()}
                                    <tr className="bg-green-50 font-medium">
                                        <td className="py-2 px-2 sticky left-0 bg-green-50">합계</td>
                                        {months.map(m => {
                                            const key = `${m.year}-${m.month}`;
                                            const total = positionSummary
                                                .filter(s => s.year === m.year && s.month === m.month)
                                                .reduce((sum, s) => sum + s.total_hours, 0);
                                            return (
                                                <td key={key} className="text-center py-2 px-1 border-l">
                                                    {total > 0 ? total : '-'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default ResourcePlansPage;
