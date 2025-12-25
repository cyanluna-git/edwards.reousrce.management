import React, { useMemo } from 'react';
import { useResourcePlans } from '@/hooks/useResourcePlans';
import { Button } from '@/components/ui';

export interface ResourceRow {
    positionId: string;
    projectRoleId: string;
    positionName: string;
    userId?: string;
    userName?: string;
    isTbd: boolean;
    monthlyData: Record<string, { planId: number; hours: number }>;
}

interface ProjectResourceTableProps {
    projectId: string;
    months: { year: number; month: number; label: string }[];
    onAddMember: () => void;
    onEditRow: (row: ResourceRow) => void;
    onDeleteRow: (row: ResourceRow) => void;
}

export const ProjectResourceTable: React.FC<ProjectResourceTableProps> = ({
    projectId,
    months,
    onAddMember,
    onEditRow,
    onDeleteRow,
}) => {
    // Lazy Load: Fetch only when this component is mounted
    const { data: plans = [], isLoading, error } = useResourcePlans({ project_id: projectId });

    // Process plans into rows
    const rows = useMemo(() => {
        const rowMap: Record<string, ResourceRow> = {};

        plans.forEach(plan => {
            // We group by the "Display Role" which is Project Role > Position
            const displayRoleId = plan.project_role_id || plan.position_id || '';
            const displayRoleName = plan.project_role_name || plan.position_name || displayRoleId;

            // Authentic IDs for editing
            const fRoleId = plan.position_id || '';
            const pRoleId = plan.project_role_id || '';

            // Key by role+user combination to group monthly data
            const key = `${displayRoleId}-${plan.user_id || 'TBD'}`;

            if (!rowMap[key]) {
                rowMap[key] = {
                    positionId: fRoleId,
                    projectRoleId: pRoleId,
                    positionName: displayRoleName,
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

        // Sort rows by name/role if needed - currently just object values
        return Object.values(rowMap);
    }, [plans]);

    if (isLoading) {
        return <div className="p-4 text-center text-sm text-gray-500">데이터를 불러오는 중...</div>;
    }

    if (error) {
        return (
            <div className="p-4 text-center text-sm text-red-500">
                데이터 로딩 실패: {(error as Error).message}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="p-4 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
                <span>등록된 인원이 없습니다.</span>
                <Button size="sm" variant="outline" onClick={onAddMember}>
                    + 팀원 추가
                </Button>
            </div>
        );
    }

    return (
        <div className="px-3 pb-3 overflow-x-auto">
            <div className="flex justify-end p-2">
                <Button size="sm" variant="outline" onClick={onAddMember}>
                    + 팀원 추가
                </Button>
            </div>
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100 min-w-[160px] z-10">
                            팀원/포지션
                        </th>
                        {months.map(m => (
                            <th key={m.label} className="text-center py-2 px-1 border-b min-w-[50px] text-xs">
                                {m.label}
                            </th>
                        ))}
                        <th className="text-center py-2 px-2 border-b min-w-[80px]">액션</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => (
                        <tr key={idx} className="border-b last:border-b-0 hover:bg-slate-50">
                            <td className="py-2 px-2 sticky left-0 bg-white z-10 font-medium">
                                <div className="flex flex-col">
                                    <span>{row.userName || 'TBD'}</span>
                                    <span className="text-xs text-muted-foreground">{row.positionName}</span>
                                </div>
                            </td>
                            {months.map(m => {
                                const key = `${m.year}-${m.month}`;
                                const data = row.monthlyData[key];
                                return (
                                    <td key={key} className="text-center py-2 px-1 border-l text-xs">
                                        {data ? data.hours : '-'}
                                    </td>
                                );
                            })}
                            <td className="text-center py-2 px-2">
                                <div className="flex justify-center gap-1">
                                    <button
                                        className="text-xs text-blue-600 hover:underline px-1"
                                        onClick={() => onEditRow(row)}
                                    >
                                        수정
                                    </button>
                                    <button
                                        className="text-xs text-red-600 hover:underline px-1"
                                        onClick={() => onDeleteRow(row)}
                                    >
                                        삭제
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-slate-50 font-semibold text-xs border-t-2">
                        <td className="py-2 px-2 sticky left-0 bg-slate-50 z-10 text-right">
                            합계
                        </td>
                        {months.map(m => {
                            const key = `${m.year}-${m.month}`;
                            const total = rows.reduce((sum, r) => sum + (r.monthlyData[key]?.hours || 0), 0);
                            return (
                                <td key={key} className="text-center py-2 px-1 border-l">
                                    {total > 0 ? total.toFixed(1).replace(/\.0$/, '') : '-'}
                                </td>
                            );
                        })}
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};
