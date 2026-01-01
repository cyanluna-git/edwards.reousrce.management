import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { ResourcePlan, Project } from '@/types';

interface MonthInfo {
    year: number;
    month: number;
    label: string;
}

interface RoleSummaryTabProps {
    months: MonthInfo[];
    allResourcePlans: ResourcePlan[];
    projects: Project[];
}

/**
 * Role Summary Tab Component
 * Displays aggregated resource plan data grouped by business unit and role
 */
export const RoleSummaryTab: React.FC<RoleSummaryTabProps> = ({
    months,
    allResourcePlans,
    projects,
}) => {
    // Build project -> business unit mapping (use project name if no BU)
    const projectBuMap: Record<string, string> = {};
    projects.forEach(p => {
        const buName = p.program?.business_unit?.name;
        if (!buName) {
            console.log('[RoleSummaryTab] Project without BU:', p.id, p.name, 'program:', p.program);
        }
        projectBuMap[p.id] = buName || 'Unassigned';
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
        const bu = projectBuMap[plan.project_id];
        if (!bu) {
            console.log('[RoleSummaryTab] ResourcePlan with missing project:', plan.project_id, 'plan:', plan);
        }
        const finalBu = bu || 'Unassigned';
        const roleId = plan.project_role_id
            ? String(plan.project_role_id)
            : (plan.position_id ? String(plan.position_id) : 'unknown');
        const roleName = plan.project_role_name || plan.position_name || roleId;
        const monthKey = `${plan.year}-${plan.month}`;

        if (!grouped[finalBu]) {
            grouped[finalBu] = {};
        }
        if (!grouped[finalBu][roleId]) {
            grouped[finalBu][roleId] = {
                id: roleId,
                name: roleName,
                data: {},
                totalFte: 0
            };
        }

        grouped[finalBu][roleId].data[monthKey] =
            (grouped[finalBu][roleId].data[monthKey] || 0) + plan.planned_hours;
        grouped[finalBu][roleId].totalFte += plan.planned_hours;
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
                                <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100 min-w-[200px]">프로젝트 역할</th>
                                {months.map(m => (
                                    <th key={`${m.year}-${m.month}`} className="text-center py-2 px-1 border-b text-xs font-medium min-w-[60px]">
                                        {m.label}
                                    </th>
                                ))}
                                <th className="text-center py-2 px-1 border-b text-xs font-medium min-w-[60px]">합계</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedBUs
                                .filter(area => grouped[area] && Object.keys(grouped[area]).length > 0)
                                .map(area => {
                                    const areaPositions = Object.values(grouped[area])
                                        .sort((a, b) => b.totalFte - a.totalFte);
                                    const areaTotal = areaPositions.reduce((sum, p) => sum + p.totalFte, 0);

                                    return (
                                        <React.Fragment key={area}>
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
                                })}
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
    );
};

export default RoleSummaryTab;
