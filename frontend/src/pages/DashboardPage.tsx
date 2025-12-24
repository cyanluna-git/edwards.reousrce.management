import React, { useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useDashboard } from '@/hooks/useDashboard';
import { useWorklogsTable } from '@/hooks/useWorklogs';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

// L1 Category colors
const L1_CATEGORY_COLORS: Record<string, { color: string; name: string; name_ko: string }> = {
    'ENG': { color: '#3b82f6', name: 'Engineering', name_ko: '엔지니어링' },
    'PRJ': { color: '#f59e0b', name: 'Project Execution', name_ko: '프로젝트 실행' },
    'OPS': { color: '#10b981', name: 'Operations', name_ko: '운영' },
    'QMS': { color: '#ef4444', name: 'Quality & Compliance', name_ko: '품질/규정준수' },
    'KNW': { color: '#8b5cf6', name: 'Knowledge Work', name_ko: '지식업무' },
    'SUP': { color: '#ec4899', name: 'Support & Service', name_ko: '지원/서비스' },
    'ADM': { color: '#64748b', name: 'Administration', name_ko: '행정' },
    'ABS': { color: '#94a3b8', name: 'Absence', name_ko: '부재' },
};

// Legacy work_type to L1 category mapping
const WORK_TYPE_TO_L1: Record<string, string> = {
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

// L2 Subcategory colors (lighter shades within each L1)
const L2_COLORS: Record<string, Record<string, string>> = {
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

type ViewMode = 'weekly' | 'monthly';

export const DashboardPage: React.FC = () => {
    const { data, isLoading, error } = useDashboard();
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState<ViewMode>('weekly');
    const [drillDownL1, setDrillDownL1] = useState<string | null>(null);

    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

    const { data: weeklyWorklogs = [] } = useWorklogsTable({
        start_date: weekStart,
        end_date: weekEnd,
        user_id: user?.id,
        limit: 100,
    });

    const { data: monthlyWorklogs = [] } = useWorklogsTable({
        start_date: monthStart,
        end_date: monthEnd,
        user_id: user?.id,
        limit: 200,
    });

    const currentWorklogs = viewMode === 'weekly' ? weeklyWorklogs : monthlyWorklogs;
    const totalHours = currentWorklogs.reduce((sum, wl) => sum + wl.hours, 0);

    // Group by project
    const projectSummary = currentWorklogs.reduce((acc, wl) => {
        const key = wl.project_id;
        if (!acc[key]) {
            acc[key] = { project_id: wl.project_id, project_code: wl.project_code || '', project_name: wl.project_name || '', hours: 0 };
        }
        acc[key].hours += wl.hours;
        return acc;
    }, {} as Record<string, { project_id: string; project_code: string; project_name: string; hours: number }>);
    const projectList = Object.values(projectSummary).sort((a, b) => b.hours - a.hours);

    // Group by L1 category for pie chart
    const l1Summary = currentWorklogs.reduce((acc, wl) => {
        const l1Code = WORK_TYPE_TO_L1[wl.work_type] || 'ADM';
        if (!acc[l1Code]) {
            const category = L1_CATEGORY_COLORS[l1Code] || L1_CATEGORY_COLORS['ADM'];
            acc[l1Code] = { name: category.name_ko, code: l1Code, value: 0 };
        }
        acc[l1Code].value += wl.hours;
        return acc;
    }, {} as Record<string, { name: string; code: string; value: number }>);

    const workTypeData = Object.values(l1Summary)
        .sort((a, b) => b.value - a.value)
        .map(item => ({
            ...item,
            color: L1_CATEGORY_COLORS[item.code]?.color || '#64748b',
            percentage: totalHours > 0 ? ((item.value / totalHours) * 100).toFixed(0) : '0',
        }));

    // L2 drill-down data (when a L1 is clicked)
    const l2DrillDownData = drillDownL1 ? currentWorklogs
        .filter(wl => WORK_TYPE_TO_L1[wl.work_type] === drillDownL1)
        .reduce((acc, wl) => {
            const key = wl.work_type;
            if (!acc[key]) {
                acc[key] = { name: key, code: key, value: 0 };
            }
            acc[key].value += wl.hours;
            return acc;
        }, {} as Record<string, { name: string; code: string; value: number }>)
        : {};

    const l2TotalHours = Object.values(l2DrillDownData).reduce((sum, item) => sum + item.value, 0);
    const l2ChartData = Object.values(l2DrillDownData)
        .sort((a, b) => b.value - a.value)
        .map(item => ({
            ...item,
            color: L2_COLORS[drillDownL1 || '']?.[item.name] || L1_CATEGORY_COLORS[drillDownL1 || '']?.color || '#64748b',
            percentage: l2TotalHours > 0 ? ((item.value / l2TotalHours) * 100).toFixed(0) : '0',
        }));

    const activeChartData = drillDownL1 ? l2ChartData : workTypeData;
    const activeLabel = drillDownL1 ? L1_CATEGORY_COLORS[drillDownL1]?.name_ko : null;

    if (isLoading) {
        return <div className="container mx-auto p-4"><div className="text-center py-12">로딩 중...</div></div>;
    }

    if (error || !data) {
        return <div className="container mx-auto p-4"><div className="text-center py-12 text-red-500">대시보드를 불러오는데 실패했습니다.</div></div>;
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-6">
                <h1 className="text-2xl font-bold">👋 안녕하세요, {data.user.name}님!</h1>
                <p className="text-blue-100 mt-1">오늘도 좋은 하루 되세요.</p>
            </div>

            {/* View Mode Tabs */}
            <div className="flex gap-2">
                <Button variant={viewMode === 'weekly' ? 'default' : 'outline'} onClick={() => setViewMode('weekly')} size="sm">
                    📅 이번 주
                </Button>
                <Button variant={viewMode === 'monthly' ? 'default' : 'outline'} onClick={() => setViewMode('monthly')} size="sm">
                    📆 이번 달
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {viewMode === 'weekly' ? '이번 주 WorkLog' : '이번 달 WorkLog'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalHours.toFixed(0)}h</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {viewMode === 'weekly' ? `${weekStart} ~ ${weekEnd}` : `${monthStart} ~ ${monthEnd}`}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">참여 프로젝트</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{projectList.length}개</div>
                        <p className="text-xs text-muted-foreground mt-1">{viewMode === 'weekly' ? '이번 주' : '이번 달'}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">이번 달 배정량</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{data.resource_allocation.total_fte} FTE</div>
                        <p className="text-xs text-muted-foreground mt-1">계획된 리소스</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* WorkLog by Project */}
                <Card>
                    <CardHeader>
                        <CardTitle>{viewMode === 'weekly' ? '주간' : '월간'} 프로젝트별 WorkLog</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {projectList.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">데이터가 없습니다.</div>
                        ) : (
                            <div className="space-y-3">
                                {projectList.map(proj => (
                                    <div key={proj.project_id} className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <div className="text-sm font-medium truncate">{proj.project_code} - {proj.project_name}</div>
                                            <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                                                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min((proj.hours / totalHours) * 100, 100)}%` }} />
                                            </div>
                                        </div>
                                        <div className="text-sm font-medium w-12 text-right">{proj.hours.toFixed(0)}h</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Work Type Pie Chart - Interactive Drill-Down */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            {drillDownL1 ? (
                                <>
                                    <button
                                        onClick={() => setDrillDownL1(null)}
                                        className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                                        title="뒤로가기"
                                    >
                                        ←
                                    </button>
                                    <span style={{ color: L1_CATEGORY_COLORS[drillDownL1]?.color }}>
                                        {activeLabel}
                                    </span>
                                    <span className="text-muted-foreground text-sm font-normal">상세</span>
                                </>
                            ) : (
                                <>{viewMode === 'weekly' ? '주간' : '월간'} 업무 유형별 비율</>
                            )}
                        </CardTitle>
                        {!drillDownL1 && (
                            <span className="text-xs text-muted-foreground">클릭하여 상세 보기</span>
                        )}
                    </CardHeader>
                    <CardContent>
                        {activeChartData.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">데이터가 없습니다.</div>
                        ) : (
                            <div className="flex flex-col lg:flex-row items-center gap-6">
                                <div className="w-60 h-60 transition-all duration-300">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={activeChartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={55}
                                                outerRadius={90}
                                                paddingAngle={2}
                                                dataKey="value"
                                                animationDuration={400}
                                                onClick={(data) => {
                                                    if (!drillDownL1 && data.code) {
                                                        setDrillDownL1(data.code);
                                                    }
                                                }}
                                                style={{ cursor: drillDownL1 ? 'default' : 'pointer' }}
                                            >
                                                {activeChartData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={entry.color}
                                                        className={!drillDownL1 ? 'hover:opacity-80 transition-opacity' : ''}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: number | undefined) => [
                                                    `${(value ?? 0).toFixed(0)}h`,
                                                    '시간'
                                                ]}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex-1 space-y-2">
                                    {activeChartData.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-3 p-2 rounded-lg transition-all ${!drillDownL1 ? 'hover:bg-slate-50 cursor-pointer' : ''
                                                }`}
                                            onClick={() => {
                                                if (!drillDownL1 && item.code) {
                                                    setDrillDownL1(item.code);
                                                }
                                            }}
                                        >
                                            <div
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <span className="flex-1 font-medium">{item.name}</span>
                                            <span className="font-bold text-lg">{item.value.toFixed(0)}h</span>
                                            <span className="text-muted-foreground bg-slate-100 px-2 py-0.5 rounded text-sm">
                                                {item.percentage}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* My Projects Timeline */}
            <Card>
                <CardHeader>
                    <CardTitle>참여 프로젝트 현황</CardTitle>
                </CardHeader>
                <CardContent>
                    {data.my_projects.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">참여 중인 프로젝트가 없습니다.</div>
                    ) : (
                        <div className="space-y-4">
                            {data.my_projects.map(project => (
                                <div key={project.id} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-medium">{project.code} - {project.name}</h3>
                                            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${project.status === 'WIP' ? 'bg-green-100 text-green-700' :
                                                project.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                                                    project.status === 'Hold' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                {project.status}
                                            </span>
                                        </div>
                                    </div>
                                    {project.milestones.length > 0 && (
                                        <div className="flex gap-4 mt-3 text-sm">
                                            {project.milestones.map((m, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${m.status === 'Completed' ? 'bg-green-500 text-white' :
                                                        m.status === 'At risk' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                                                        }`}>
                                                        {m.name.substring(0, 2)}
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        {m.target_date ? format(new Date(m.target_date), 'yy-MMM') : '-'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DashboardPage;
