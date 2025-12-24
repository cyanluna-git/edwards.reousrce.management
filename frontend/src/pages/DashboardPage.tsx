import React, { useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useDashboard } from '@/hooks/useDashboard';
import { useWorklogsTable } from '@/hooks/useWorklogs';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

// Colors for work types
const WORK_TYPE_COLORS: Record<string, string> = {
    'SW Develop': '#3b82f6',
    'Documentation': '#8b5cf6',
    'Meeting': '#f59e0b',
    'Design': '#10b981',
    'Review': '#6366f1',
    'Training': '#ec4899',
    'Test': '#14b8a6',
    'Leave': '#94a3b8',
    'Support': '#f97316',
    'Management': '#84cc16',
};

type ViewMode = 'weekly' | 'monthly';

export const DashboardPage: React.FC = () => {
    const { data, isLoading, error } = useDashboard();
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState<ViewMode>('weekly');

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

    // Group by work type for pie chart
    const workTypeSummary = currentWorklogs.reduce((acc, wl) => {
        const key = wl.work_type;
        if (!acc[key]) {
            acc[key] = { name: key, value: 0 };
        }
        acc[key].value += wl.hours;
        return acc;
    }, {} as Record<string, { name: string; value: number }>);

    const workTypeData = Object.values(workTypeSummary)
        .sort((a, b) => b.value - a.value)
        .map(item => ({
            ...item,
            color: WORK_TYPE_COLORS[item.name] || '#64748b',
            percentage: totalHours > 0 ? ((item.value / totalHours) * 100).toFixed(0) : '0',
        }));

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

                {/* Work Type Pie Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>{viewMode === 'weekly' ? '주간' : '월간'} 업무 유형별 비율</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {workTypeData.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">데이터가 없습니다.</div>
                        ) : (
                            <div className="flex flex-col lg:flex-row items-center gap-4">
                                <div className="w-40 h-40">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={workTypeData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={35}
                                                outerRadius={60}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                {workTypeData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: number) => [`${value.toFixed(0)}h`, '시간']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex-1 space-y-1">
                                    {workTypeData.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="flex-1 truncate">{item.name}</span>
                                            <span className="font-medium w-10 text-right">{item.value.toFixed(0)}h</span>
                                            <span className="text-muted-foreground w-8 text-right">{item.percentage}%</span>
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
