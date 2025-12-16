import React, { useState, useMemo } from 'react';
import {
    useResourcePlans,
    useTbdPositions,
    useCreateResourcePlan,
    useUpdateResourcePlan,
    useDeleteResourcePlan,
    useAssignUserToPlan,
    useJobPositions,
} from '@/hooks/useResourcePlans';
import { useProjects } from '@/hooks/useProjects';
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
import type { ResourcePlan, ResourcePlanCreate, Project } from '@/types';

// Month names in Korean
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export const ResourcePlansPage: React.FC = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Filters
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [showTbdOnly, setShowTbdOnly] = useState(false);

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<ResourcePlan | null>(null);
    const [assigningPlan, setAssigningPlan] = useState<ResourcePlan | null>(null);

    // Data fetching
    const { data: plans = [], isLoading } = useResourcePlans({
        year: selectedYear,
        month: selectedMonth,
        project_id: selectedProjectId || undefined,
    });
    const { data: tbdPlans = [] } = useTbdPositions({
        year: selectedYear,
        month: selectedMonth,
    });
    const { data: projects = [] } = useProjects();
    const { data: positions = [] } = useJobPositions();

    // Mutations
    const createPlan = useCreateResourcePlan();
    const updatePlan = useUpdateResourcePlan();
    const deletePlan = useDeleteResourcePlan();
    // const assignUser = useAssignUserToPlan(); // TODO: Enable when user list API is available

    // Form state
    const [formData, setFormData] = useState<Partial<ResourcePlanCreate>>({
        project_id: '',
        position_id: '',
        planned_hours: 0,
    });

    const displayedPlans = showTbdOnly ? plans.filter(p => p.is_tbd) : plans;

    const handleAddNew = () => {
        setEditingPlan(null);
        setFormData({
            project_id: selectedProjectId || '',
            position_id: '',
            planned_hours: 0,
            year: selectedYear,
            month: selectedMonth,
        });
        setIsAddModalOpen(true);
    };

    const handleEdit = (plan: ResourcePlan) => {
        setEditingPlan(plan);
        setFormData({
            project_id: plan.project_id,
            position_id: plan.position_id,
            planned_hours: plan.planned_hours,
        });
        setIsAddModalOpen(true);
    };

    const handleSubmit = () => {
        if (editingPlan) {
            updatePlan.mutate(
                { planId: editingPlan.id, data: { planned_hours: formData.planned_hours } },
                { onSuccess: () => setIsAddModalOpen(false) }
            );
        } else {
            createPlan.mutate(
                {
                    project_id: formData.project_id!,
                    position_id: formData.position_id!,
                    planned_hours: formData.planned_hours || 0,
                    year: selectedYear,
                    month: selectedMonth,
                },
                { onSuccess: () => setIsAddModalOpen(false) }
            );
        }
    };

    const handleDelete = (planId: number) => {
        if (confirm('이 리소스 계획을 삭제하시겠습니까?')) {
            deletePlan.mutate(planId);
        }
    };

    const handleAssignOpen = (plan: ResourcePlan) => {
        setAssigningPlan(plan);
    };

    // Group plans by project
    const plansByProject = useMemo(() => {
        const grouped: Record<string, { project: { id: string; name: string; code: string }; plans: ResourcePlan[] }> = {};
        displayedPlans.forEach(plan => {
            if (!grouped[plan.project_id]) {
                grouped[plan.project_id] = {
                    project: { id: plan.project_id, name: plan.project_name || '', code: plan.project_code || '' },
                    plans: [],
                };
            }
            grouped[plan.project_id].plans.push(plan);
        });
        return Object.values(grouped);
    }, [displayedPlans]);

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">리소스 계획</h1>
                <Button onClick={handleAddNew}>+ 계획 추가</Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex gap-4 flex-wrap items-center">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">연도:</label>
                            <select
                                className="px-3 py-2 border rounded-md"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                            >
                                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">월:</label>
                            <select
                                className="px-3 py-2 border rounded-md"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            >
                                {MONTHS.map((m, i) => (
                                    <option key={i + 1} value={i + 1}>{m}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">프로젝트:</label>
                            <select
                                className="px-3 py-2 border rounded-md min-w-[200px]"
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                            >
                                <option value="">전체</option>
                                {projects.map((p: Project) => (
                                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="tbd-only"
                                checked={showTbdOnly}
                                onChange={(e) => setShowTbdOnly(e.target.checked)}
                            />
                            <label htmlFor="tbd-only" className="text-sm">TBD만 보기</label>
                            {tbdPlans.length > 0 && (
                                <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                    {tbdPlans.length}개 미할당
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Plans Grid */}
            {isLoading ? (
                <div className="text-center py-8">로딩 중...</div>
            ) : plansByProject.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    {selectedYear}년 {selectedMonth}월에 등록된 리소스 계획이 없습니다.
                </div>
            ) : (
                <div className="space-y-4">
                    {plansByProject.map(({ project, plans }) => (
                        <Card key={project.id}>
                            <CardHeader className="py-3">
                                <CardTitle className="text-base">{project.code} - {project.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-2">포지션</th>
                                            <th className="text-left py-2">담당자</th>
                                            <th className="text-right py-2">계획 시간</th>
                                            <th className="text-right py-2">액션</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {plans.map(plan => (
                                            <tr key={plan.id} className={`border-b ${plan.is_tbd ? 'bg-yellow-50' : ''}`}>
                                                <td className="py-2">{plan.position_name || plan.position_id}</td>
                                                <td className="py-2">
                                                    {plan.is_tbd ? (
                                                        <span className="text-yellow-600 font-medium">
                                                            TBD
                                                            <Button
                                                                variant="link"
                                                                size="sm"
                                                                className="ml-2 text-blue-600 p-0 h-auto"
                                                                onClick={() => handleAssignOpen(plan)}
                                                            >
                                                                할당
                                                            </Button>
                                                        </span>
                                                    ) : (
                                                        plan.user_name || '-'
                                                    )}
                                                </td>
                                                <td className="py-2 text-right">{plan.planned_hours}h</td>
                                                <td className="py-2 text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(plan)}>
                                                        수정
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500"
                                                        onClick={() => handleDelete(plan.id)}
                                                    >
                                                        삭제
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingPlan ? '계획 수정' : '리소스 계획 추가'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {!editingPlan && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">프로젝트 *</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={formData.project_id}
                                        onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))}
                                    >
                                        <option value="">선택하세요</option>
                                        {projects.map((p: Project) => (
                                            <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">포지션 *</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={formData.position_id}
                                        onChange={(e) => setFormData(prev => ({ ...prev, position_id: e.target.value }))}
                                    >
                                        <option value="">선택하세요</option>
                                        {positions.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">계획 시간 (h)</label>
                            <input
                                type="number"
                                className="w-full px-3 py-2 border rounded-md"
                                value={formData.planned_hours}
                                onChange={(e) => setFormData(prev => ({ ...prev, planned_hours: Number(e.target.value) }))}
                                min={0}
                                step={0.5}
                            />
                        </div>

                        {!editingPlan && (
                            <p className="text-xs text-muted-foreground">
                                * 담당자를 지정하지 않으면 TBD(미할당) 포지션으로 생성됩니다.
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>취소</Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!editingPlan && (!formData.project_id || !formData.position_id)}
                        >
                            {createPlan.isPending || updatePlan.isPending ? '저장 중...' : '저장'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign User Modal */}
            <Dialog open={!!assigningPlan} onOpenChange={() => setAssigningPlan(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>담당자 할당</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        이 기능은 사용자 목록 API가 필요합니다. 현재는 수정 기능을 통해 user_id를 직접 설정해주세요.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssigningPlan(null)}>닫기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ResourcePlansPage;
