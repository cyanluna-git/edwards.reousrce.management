import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { ResourcePlan } from '@/types';
import type { WorklogRoleSummary } from '@/api/client';

interface MonthInfo {
    year: number;
    month: number;
    label: string;
}

interface RoleSummaryTabProps {
    months: MonthInfo[];
    allResourcePlans: ResourcePlan[];
    currentYear: number;
    currentMonth: number;
    worklogRoleSummary: WorklogRoleSummary[];
}

/**
 * Role Summary Tab Component
 * Displays aggregated resource plan data grouped by business unit and role
 * Shows plan vs actual comparison for past periods
 */
export const RoleSummaryTab: React.FC<RoleSummaryTabProps> = ({
    months,
    allResourcePlans,
    currentYear,
    currentMonth,
    worklogRoleSummary,
}) => {
    // Build worklog map: position_id -> { year-month -> fte }
    const worklogMap: Record<string, Record<string, number>> = {};
    worklogRoleSummary.forEach(w => {
        if (!worklogMap[w.position_id]) {
            worklogMap[w.position_id] = {};
        }
        worklogMap[w.position_id][`${w.year}-${w.month}`] = w.total_fte;
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

    // Group resource plans by: business_unit -> role -> month
    type PositionData = {
        id: string;
        name: string;
        data: Record<string, number>;
        totalFte: number;
    };
    type BusinessAreaData = Record<string, PositionData>;

    const grouped: Record<string, BusinessAreaData> = {};

    allResourcePlans.forEach(plan => {
        // Use business_unit_name directly from API response
        const bu = plan.business_unit_name || 'Unassigned';
        const roleId = plan.project_role_id
            ? String(plan.project_role_id)
            : (plan.position_id ? String(plan.position_id) : 'unknown');
        const roleName = plan.project_role_name || plan.position_name || roleId;
        const monthKey = `${plan.year}-${plan.month}`;

        if (!grouped[bu]) {
            grouped[bu] = {};
        }
        if (!grouped[bu][roleId]) {
            grouped[bu][roleId] = {
                id: roleId,
                name: roleName,
                data: {},
                totalFte: 0
            };
        }

        grouped[bu][roleId].data[monthKey] =
            (grouped[bu][roleId].data[monthKey] || 0) + plan.planned_hours;
        grouped[bu][roleId].totalFte += plan.planned_hours;
    });

    // Dynamically get all BUs from projects and sort alphabetically
    // Unassigned goes to the bottom
    const allBUs = Object.keys(grouped);
    const sortedBUs = allBUs.sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return a.localeCompare(b);
    });

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <CardTitle>롤별 리소스 집계 (사업영역별)</CardTitle>
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
                {allResourcePlans.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        등록된 리소스 계획이 없습니다.
                    </div>
                ) : (
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100 min-w-[200px]">프로젝트 역할</th>
                                {months.map(m => (
                                    <th key={`${m.year}-${m.month}`} className="text-center py-2 px-1 border-b text-xs font-medium min-w-[60px]">
                                        {m.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedBUs
                                .filter(area => grouped[area] && Object.keys(grouped[area]).length > 0)
                                .map(area => {
                                    const areaPositions = Object.values(grouped[area])
                                        .sort((a, b) => b.totalFte - a.totalFte);

                                    return (
                                        <React.Fragment key={area}>
                                            <tr className="bg-purple-50 border-t-2 border-purple-200">
                                                <td colSpan={months.length + 1} className="py-2 px-2 sticky left-0 bg-purple-50 font-semibold text-purple-800">
                                                    📁 {area} ({areaPositions.length}개 포지션)
                                                </td>
                                            </tr>
                                            {areaPositions.map(pos => (
                                                <tr key={`${area}-${pos.id}`} className="border-b hover:bg-slate-50">
                                                    <td className="py-1.5 px-4 sticky left-0 bg-white text-sm">
                                                        {pos.name}
                                                    </td>
                                                    {months.map(m => {
                                                        const key = `${m.year}-${m.month}`;
                                                        const plan = pos.data[key] || 0;
                                                        const actual = worklogMap[pos.id]?.[key] || 0;
                                                        const period = getTimePeriod(m.year, m.month);
                                                        return (
                                                            <td key={key} className="text-center py-1.5 px-1 border-l">
                                                                {renderCell(plan, actual, period)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                        </tbody>
                    </table>
                )}
            </CardContent>
        </Card>
    );
};

export default RoleSummaryTab;

