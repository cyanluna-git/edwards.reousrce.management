import React from 'react';
import { format } from 'date-fns';
import { useDashboard } from '@/hooks/useDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

export const DashboardPage: React.FC = () => {
    const { data, isLoading, error } = useDashboard();

    if (isLoading) {
        return (
            <div className="container mx-auto p-4">
                <div className="text-center py-12">로딩 중...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="container mx-auto p-4">
                <div className="text-center py-12 text-red-500">
                    대시보드를 불러오는데 실패했습니다.
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-6">
                <h1 className="text-2xl font-bold">
                    👋 안녕하세요, {data.user.name}님!
                </h1>
                <p className="text-blue-100 mt-1">오늘도 좋은 하루 되세요.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Weekly WorkLog Summary */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            이번 주 WorkLog
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {data.weekly_worklog.total_hours}h
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {data.weekly_worklog.week_start} ~ {data.weekly_worklog.week_end}
                        </p>
                    </CardContent>
                </Card>

                {/* Active Projects */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            참여 프로젝트
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {data.resource_allocation.active_projects}개
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {data.resource_allocation.current_month}
                        </p>
                    </CardContent>
                </Card>

                {/* Current Month FTE */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            이번 달 배정량
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {data.resource_allocation.total_fte} FTE
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            계획된 리소스
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Weekly WorkLog by Project */}
            <Card>
                <CardHeader>
                    <CardTitle>주간 WorkLog 상세</CardTitle>
                </CardHeader>
                <CardContent>
                    {data.weekly_worklog.by_project.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                            이번 주 기록된 WorkLog가 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {data.weekly_worklog.by_project.map(proj => (
                                <div key={proj.project_id} className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium">
                                            {proj.project_code} - {proj.project_name}
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full"
                                                style={{
                                                    width: `${Math.min((proj.hours / data.weekly_worklog.total_hours) * 100, 100)}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-sm font-medium w-16 text-right">
                                        {proj.hours}h
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* My Projects Timeline */}
            <Card>
                <CardHeader>
                    <CardTitle>참여 프로젝트 현황</CardTitle>
                </CardHeader>
                <CardContent>
                    {data.my_projects.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                            참여 중인 프로젝트가 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {data.my_projects.map(project => (
                                <div key={project.id} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-medium">
                                                {project.code} - {project.name}
                                            </h3>
                                            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${project.status === 'WIP' ? 'bg-green-100 text-green-700' :
                                                    project.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                                                        project.status === 'Hold' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-slate-100 text-slate-700'
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
                                                            m.status === 'At risk' ? 'bg-red-500 text-white' :
                                                                'bg-blue-500 text-white'
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
