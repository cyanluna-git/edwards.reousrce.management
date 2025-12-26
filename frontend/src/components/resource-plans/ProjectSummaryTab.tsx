import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { ProjectSummary, WorklogProjectSummary } from '@/api/client';
import type { Project } from '@/types';

interface MonthInfo {
    year: number;
    month: number;
    label: string;
}

interface ProjectSummaryTabProps {
    months: MonthInfo[];
    projectSummary: ProjectSummary[];
    projects: Project[];
    worklogSummary: WorklogProjectSummary[];
    currentYear: number;
    currentMonth: number;
}

/**
 * Project Summary Tab Component
 * Displays aggregated resource plan data grouped by business unit
 * Shows plan vs actual comparison with color coding
 */
export const ProjectSummaryTab: React.FC<ProjectSummaryTabProps> = ({
    months,
    projectSummary,
    projects,
    worklogSummary,
    currentYear,
    currentMonth,
}) => {
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
    const getTimePeriod = (year: number, month: number): 'past' | 'current' | 'future' => {
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
            return (
                <span className="text-slate-400">
                    {plan > 0 ? Number(plan.toFixed(1)) : '-'}
                </span>
            );
        } else if (period === 'current') {
            if (plan === 0 && actual === 0) return <span>-</span>;
            return (
                <span className="text-orange-600 font-medium">
                    {Number(plan.toFixed(1))}/{Number(actual.toFixed(1))}
                </span>
            );
        } else {
            if (actual === 0 && plan === 0) {
                return <span>-</span>;
            }
            const diff = actual - plan;
            let colorClass = 'text-blue-600';
            if (plan > 0 && actual > 0) {
                if (diff > 0.1) colorClass = 'text-red-600';
                else if (diff < -0.1) colorClass = 'text-green-600';
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

    return (
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
                            {businessAreaOrder
                                .filter(area => grouped[area]?.length > 0)
                                .map(area => {
                                    const areaProjects = grouped[area];
                                    const areaTotal = areaProjects.reduce((sum, p) => sum + p.totalFte, 0);

                                    return (
                                        <React.Fragment key={area}>
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
                                })}
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
    );
};

export default ProjectSummaryTab;
