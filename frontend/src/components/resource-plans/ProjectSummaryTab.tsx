import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { ProjectSummary, WorklogProjectSummary } from '@/api/client';
import type { Project } from '@/types';
import { useProjectHierarchy, type HierarchyNode } from '@/hooks/useProjectHierarchy';

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
 * Displays aggregated resource plan data grouped by BU > Product Line > Project
 * Shows plan vs actual comparison with color coding
 */
export const ProjectSummaryTab: React.FC<ProjectSummaryTabProps> = ({
    months,
    projectSummary,
    worklogSummary,
    currentYear,
    currentMonth,
}) => {
    // Use the same hierarchy as Projects page
    const { data: hierarchy } = useProjectHierarchy();
    const productProjects = hierarchy?.product_projects || [];

    // Build worklog map: project_id -> { year-month -> fte }
    const worklogMap: Record<string, Record<string, number>> = {};
    worklogSummary.forEach(w => {
        if (!worklogMap[w.project_id]) {
            worklogMap[w.project_id] = {};
        }
        worklogMap[w.project_id][`${w.year}-${w.month}`] = w.total_fte;
    });

    // Build plan map: project_id -> { year-month -> hours }
    const planMap: Record<string, Record<string, number>> = {};
    const planTotalMap: Record<string, number> = {};
    projectSummary.forEach(s => {
        if (!planMap[s.project_id]) {
            planMap[s.project_id] = {};
            planTotalMap[s.project_id] = 0;
        }
        planMap[s.project_id][`${s.year}-${s.month}`] = s.total_hours;
        planTotalMap[s.project_id] += s.total_hours;
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

    // Helper: calculate totals for a node
    const calculateNodeTotal = (node: HierarchyNode, monthKey?: string): number => {
        if (node.type === 'project') {
            if (monthKey) {
                return planMap[node.id]?.[monthKey] || 0;
            }
            return planTotalMap[node.id] || 0;
        }
        return (node.children || []).reduce((sum, child) => sum + calculateNodeTotal(child, monthKey), 0);
    };

    // Helper: count projects in a node
    const countProjects = (node: HierarchyNode): number => {
        if (node.type === 'project') return 1;
        return (node.children || []).reduce((sum, child) => sum + countProjects(child), 0);
    };

    // Render project row
    const renderProjectRow = (project: HierarchyNode, indent: number) => {
        const projectPlan = planMap[project.id] || {};
        const projectActual = worklogMap[project.id] || {};
        const totalFte = planTotalMap[project.id] || 0;

        return (
            <tr key={project.id} className="border-b hover:bg-slate-50">
                <td className="py-1.5 px-2 sticky left-0 bg-white text-sm" style={{ paddingLeft: `${indent * 16 + 8}px` }}>
                    <span className="text-slate-400 mr-1">◆</span>
                    {project.code} - {project.name}
                </td>
                {months.map(m => {
                    const key = `${m.year}-${m.month}`;
                    const plan = projectPlan[key] || 0;
                    const actual = projectActual[key] || 0;
                    const period = getTimePeriod(m.year, m.month);
                    return (
                        <td key={key} className="text-center py-1.5 px-1 border-l text-xs">
                            {renderCell(plan, actual, period)}
                        </td>
                    );
                })}
                <td className="text-center py-1.5 px-1 border-l font-medium">
                    {totalFte > 0 ? Number(totalFte.toFixed(1)) : '-'}
                </td>
            </tr>
        );
    };

    // Render product line row (header + projects)
    const renderProductLineSection = (pl: HierarchyNode, indent: number) => {
        const plProjects = pl.children || [];
        const plTotal = calculateNodeTotal(pl);
        const projectCount = countProjects(pl);

        return (
            <React.Fragment key={pl.id}>
                {/* Product Line Header */}
                <tr className="bg-green-50 border-t border-green-200">
                    <td className="py-1.5 px-2 sticky left-0 bg-green-50 font-medium text-green-800" style={{ paddingLeft: `${indent * 16 + 8}px` }}>
                        ▸ {pl.name} {pl.code && <span className="text-xs text-green-600">({pl.code})</span>}
                        <span className="text-xs text-green-600 ml-2">{projectCount}개</span>
                    </td>
                    {months.map(m => {
                        const key = `${m.year}-${m.month}`;
                        const monthTotal = calculateNodeTotal(pl, key);
                        return (
                            <td key={key} className="text-center py-1.5 px-1 border-l text-xs font-medium text-green-700">
                                {monthTotal > 0 ? Number(monthTotal.toFixed(1)) : '-'}
                            </td>
                        );
                    })}
                    <td className="text-center py-1.5 px-1 border-l font-medium text-green-800">
                        {plTotal > 0 ? Number(plTotal.toFixed(1)) : '-'}
                    </td>
                </tr>
                {/* Projects under this Product Line */}
                {plProjects.map(project => renderProjectRow(project, indent + 1))}
            </React.Fragment>
        );
    };

    // Render Business Unit section
    const renderBusinessUnitSection = (bu: HierarchyNode) => {
        const buTotal = calculateNodeTotal(bu);
        const projectCount = countProjects(bu);
        const productLines = bu.children || [];

        return (
            <React.Fragment key={bu.id}>
                {/* Business Unit Header */}
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td className="py-2 px-2 sticky left-0 bg-blue-50 font-semibold text-blue-800">
                        📁 {bu.name} <span className="text-xs text-blue-600">({bu.code})</span>
                        <span className="text-sm text-blue-600 ml-2">({projectCount}개 프로젝트)</span>
                    </td>
                    {months.map(m => {
                        const key = `${m.year}-${m.month}`;
                        const monthTotal = calculateNodeTotal(bu, key);
                        return (
                            <td key={key} className="text-center py-2 px-1 border-l font-medium text-blue-700">
                                {monthTotal > 0 ? Number(monthTotal.toFixed(1)) : '-'}
                            </td>
                        );
                    })}
                    <td className="text-center py-2 px-1 border-l font-bold text-blue-800">
                        {buTotal > 0 ? Number(buTotal.toFixed(1)) : '-'}
                    </td>
                </tr>
                {/* Product Lines under this Business Unit */}
                {productLines.map(pl => renderProductLineSection(pl, 1))}
            </React.Fragment>
        );
    };

    // Calculate grand total
    const grandTotal = useMemo(() => {
        return projectSummary.reduce((sum, s) => sum + s.total_hours, 0);
    }, [projectSummary]);

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
                {productProjects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        등록된 리소스 계획이 없습니다.
                    </div>
                ) : (
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100 min-w-[350px]">프로젝트</th>
                                {months.map(m => (
                                    <th key={`${m.year}-${m.month}`} className="text-center py-2 px-1 border-b text-xs font-medium min-w-[60px]">
                                        {m.label}
                                    </th>
                                ))}
                                <th className="text-center py-2 px-1 border-b text-xs font-medium min-w-[60px]">합계</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productProjects.map(bu => renderBusinessUnitSection(bu))}
                            {/* Grand Total Row */}
                            <tr className="bg-amber-50 font-bold border-t-2 border-amber-300">
                                <td className="py-2 px-2 sticky left-0 bg-amber-50">🔢 전체 합계</td>
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
                                    {Number(grandTotal.toFixed(1))}
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

