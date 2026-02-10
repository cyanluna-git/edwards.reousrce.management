/**
 * ResourcePivotTable - Master Headcount Pivot Sheet
 * Shows resource allocation by User x IO (Internal/Recharge)
 * 
 * Performance optimizations:
 * - React.memo for row components
 * - Optimized query caching (10min staleTime)
 * - Memoized grouping calculations
 */
import React, { memo, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    getResourcePivotMatrix,
    type PivotMatrixResponse,
    type PivotRow,
} from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Building2, Users } from 'lucide-react';

interface ResourcePivotTableProps {
    startMonth: string;
    endMonth: string;
    departmentId?: string;
    programId?: string;
    onCellClick?: (userId: string, userName: string, ioId: string, ioName: string) => void;
}

export const ResourcePivotTable: React.FC<ResourcePivotTableProps> = ({
    startMonth,
    endMonth,
    departmentId,
    programId,
    onCellClick,
}) => {
    const { t } = useTranslation('resource-plans');

    // ✅ OPTIMIZED: Longer staleTime for reference data (resource matrix changes infrequently)
    const { data, isLoading, error } = useQuery<PivotMatrixResponse>({
        queryKey: ['resource-pivot', startMonth, endMonth, departmentId, programId],
        queryFn: () => getResourcePivotMatrix(startMonth, endMonth, departmentId, programId),
        enabled: !!startMonth && !!endMonth,
        staleTime: 10 * 60 * 1000, // 10 minutes (longer than default 5min)
        gcTime: 60 * 60 * 1000, // 1 hour cache
        refetchOnWindowFocus: false, // Don't refetch on window focus
    });

    // State for collapsed groups
    // Keys: "dept:{DeptName}" or "sub:{DeptName}:{SubTeamName}"
    const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

    // ✅ OPTIMIZED: useCallback for stable function reference
    const toggleCollapse = useCallback((key: string) => {
        setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // ✅ OPTIMIZED: Memoized grouping calculation
    const groupedRows = useMemo(() => {
        if (!data) return {};

        type GroupStructure = {
            totalFte: number;
            rows: PivotRow[]; // Direct reports (no subteam)
            subTeams: Record<string, { rows: PivotRow[], totalFte: number }>;
        };
        const groups: Record<string, GroupStructure> = {};

        // Sort rows by department, then sub-team, then name
        const sortedRows = [...data.rows].sort((a, b) => {
            const deptA = a.department_name || 'Unassigned';
            const deptB = b.department_name || 'Unassigned';
            if (deptA !== deptB) return deptA.localeCompare(deptB);

            // If Deuts match, sort by SubTeam (nulls first or last? let's say last)
            const subA = a.sub_team_name || '';
            const subB = b.sub_team_name || '';
            if (subA !== subB) {
                if (!subA) return 1; // Put direct reports at bottom? Or top? Let's put at bottom (General)
                if (!subB) return -1;
                return subA.localeCompare(subB);
            }

            return a.user_name.localeCompare(b.user_name);
        });

        sortedRows.forEach(row => {
            const dept = row.department_name || 'Unassigned';
            const subTeam = row.sub_team_name;

            if (!groups[dept]) groups[dept] = { totalFte: 0, rows: [], subTeams: {} };

            groups[dept].totalFte += row.total_fte;

            if (subTeam) {
                if (!groups[dept].subTeams[subTeam]) {
                    groups[dept].subTeams[subTeam] = { rows: [], totalFte: 0 };
                }
                groups[dept].subTeams[subTeam].rows.push(row);
                groups[dept].subTeams[subTeam].totalFte += row.total_fte;
            } else {
                groups[dept].rows.push(row);
            }
        });
        return groups;
    }, [data]);

    // ✅ OPTIMIZED: Memoized badge component
    const getIOBadge = useMemo(() => {
        const badgeMap = {
            'INTERNAL': <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-200">INT</Badge>,
            'RECHARGE': <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 hover:bg-green-200">RCH</Badge>,
        };
        return (type: string) => badgeMap[type as keyof typeof badgeMap] || null;
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-lg text-muted-foreground">{t('pivot.loading')}</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-lg text-red-600">
                    {t('pivot.errorLoading', { message: error instanceof Error ? error.message : t('pivot.unknownError') })}
                </div>
            </div>
        );
    }

    if (!data || data.rows.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-lg text-muted-foreground">
                    {t('pivot.noData')}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto border rounded-lg shadow-sm">
            <table className="border-collapse w-full text-sm">
                {/* Sticky Header */}
                <thead className="sticky top-0 bg-slate-50 z-20 shadow-sm">
                    <tr>
                        {/* User Column (Sticky Left) */}
                        <th className="sticky left-0 bg-slate-100 border border-slate-300 p-3 min-w-[200px] text-left font-bold z-30 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                            <div className="flex flex-col">
                                <span className="text-slate-800">{t('pivot.resource')}</span>
                                <span className="text-xs text-slate-500 font-normal">{t('pivot.namePosition')}</span>
                            </div>
                        </th>

                        {/* Dynamic IO Columns */}
                        {data.columns.map((col) => (
                            <th
                                key={col.id}
                                className="border border-slate-300 p-2 min-w-[100px] text-center align-top bg-white group hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex flex-col items-center gap-1">
                                    <div className="flex items-center gap-1">
                                        {getIOBadge(col.type)}
                                        <span className="font-mono text-xs font-bold text-slate-700">
                                            {col.label}
                                        </span>
                                    </div>
                                    {col.name && (
                                        <span className="text-[10px] text-slate-500 line-clamp-2 leading-tight px-1 h-8">
                                            {col.name}
                                        </span>
                                    )}
                                    {/* Total at Top */}
                                    <div className="mt-1 pt-1 border-t w-full text-center">
                                        <span className="text-xs font-bold text-blue-700">
                                            {col.total_fte.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                            </th>
                        ))}

                        {/* Total Column */}
                        <th className="sticky right-0 bg-blue-50 border border-slate-300 p-2 min-w-[80px] font-bold text-blue-900 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)] z-20 align-top">
                            <div className="flex flex-col h-full justify-between">
                                <span>{t('pivot.total')}</span>
                                <span className="text-xs mt-auto pt-2">{data.grand_total.toFixed(1)}</span>
                            </div>
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {Object.entries(groupedRows).map(([deptName, group]) => {
                        const deptKey = `dept:${deptName}`;
                        const isDeptCollapsed = collapsed[deptKey];

                        return (
                            <React.Fragment key={deptName}>
                                {/* Department Group Header */}
                                <tr
                                    className="bg-slate-100 hover:bg-slate-200/50 cursor-pointer select-none transition-colors border-b border-slate-300/50"
                                    onClick={() => toggleCollapse(deptKey)}
                                >
                                    <td
                                        colSpan={data.columns.length + 2}
                                        className="p-2 pl-2 font-bold text-slate-700 sticky left-0 z-10"
                                        style={{ left: 0 }}
                                    >
                                        <div className="flex items-center gap-2">
                                            {isDeptCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                            <Building2 size={16} className="text-slate-500" />
                                            <span>{deptName === 'Unassigned' ? t('pivot.unassigned') : deptName}</span>
                                            <Badge variant="outline" className="ml-2 text-xs font-normal text-slate-500 bg-white">
                                                {group.totalFte.toFixed(1)} FTE
                                            </Badge>
                                        </div>
                                    </td>
                                </tr>

                                {/* If not collapsed, render contents */}
                                {!isDeptCollapsed && (
                                    <>
                                        {/* 1. Render SubTeams */}
                                        {Object.entries(group.subTeams).map(([subTeamName, subTeamGroup]) => {
                                            const subKey = `sub:${deptName}:${subTeamName}`;
                                            const isSubCollapsed = collapsed[subKey];

                                            return (
                                                <React.Fragment key={subTeamName}>
                                                    {/* SubTeam Header */}
                                                    <tr
                                                        className="bg-slate-50/80 hover:bg-slate-100 cursor-pointer select-none transition-colors border-b border-slate-200"
                                                        onClick={() => toggleCollapse(subKey)}
                                                    >
                                                        <td
                                                            colSpan={data.columns.length + 2}
                                                            className="p-2 pl-8 font-semibold text-slate-600 sticky left-0 z-10"
                                                            style={{ left: 0 }}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {isSubCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                                                <Users size={14} className="text-slate-400" />
                                                                <span>{subTeamName}</span>
                                                                <span className="text-xs text-slate-400 font-normal">
                                                                    ({subTeamGroup.totalFte.toFixed(1)} FTE)
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* SubTeam Rows */}
                                                    {!isSubCollapsed && subTeamGroup.rows.map(row => (
                                                        <RowItem
                                                            key={row.user_id || 'tbd'}
                                                            row={row}
                                                            columns={data.columns}
                                                            indentLevel={2}
                                                            onCellClick={onCellClick}
                                                        />
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* 2. Render Direct Rows (No SubTeam) */}
                                        {group.rows.length > 0 && (
                                            <>
                                                {/* Optional: Add "General" header if there are subteams, to separate? */}
                                                {Object.keys(group.subTeams).length > 0 && (
                                                    <tr className="bg-slate-50/50 border-b border-slate-200">
                                                        <td colSpan={data.columns.length + 2} className="p-1 pl-10 text-xs font-medium text-slate-400 sticky left-0 z-10">
                                                            {t('pivot.directReports')}
                                                        </td>
                                                    </tr>
                                                )}
                                                {group.rows.map(row => (
                                                    <RowItem
                                                        key={row.user_id || 'tbd'}
                                                        row={row}
                                                        columns={data.columns}
                                                        indentLevel={Object.keys(group.subTeams).length > 0 ? 2 : 1}
                                                        onCellClick={onCellClick}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ✅ OPTIMIZED: Memoized row component with custom comparison
const RowItem: React.FC<{
    row: PivotRow;
    columns: PivotMatrixResponse['columns'];
    indentLevel: number;
    onCellClick?: (userId: string, userName: string, ioId: string, ioName: string) => void;
}> = memo(({ row, columns, indentLevel, onCellClick }) => {
    // indentLevel 1 = 1.5rem (pl-6), indentLevel 2 = 3rem (pl-12)
    const paddingLeft = indentLevel === 1 ? 'pl-8' : 'pl-14';

    return (
        <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100">
            {/* User Info (Sticky Left) */}
            <td className={cn(
                "sticky left-0 bg-white border-r border-slate-300 p-2 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]",
                paddingLeft
            )}>
                <div className="flex flex-col">
                    <span className="font-medium text-slate-800 text-sm">{row.user_name}</span>
                    {row.position_name && (
                        <span className="text-[11px] text-slate-500">{row.position_name}</span>
                    )}
                </div>
            </td>

            {/* IO Cells */}
            {columns.map((col) => {
                const val = row.allocations[col.id] || 0;
                return (
                    <td
                        key={`${row.user_id}-${col.id}`}
                        className={cn(
                            "border-r border-slate-200 p-2 text-right font-mono text-xs",
                            val > 0 ? "text-slate-800 font-medium cursor-pointer hover:bg-blue-50" : "text-slate-300"
                        )}
                        onClick={() => {
                            if (val > 0 && onCellClick && row.user_id) {
                                onCellClick(row.user_id, row.user_name, col.id, col.name || col.label);
                            }
                        }}
                    >
                        {val > 0 ? val.toFixed(2) : '-'}
                    </td>
                );
            })}

            {/* Row Total (Sticky Right) */}
            <td className="sticky right-0 bg-blue-50 border-l border-slate-300 p-2 text-right font-bold text-blue-900 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)] z-10 text-xs">
                {row.total_fte.toFixed(1)}
            </td>
        </tr>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for better performance
    // Only re-render if relevant props changed
    return (
        prevProps.row.user_id === nextProps.row.user_id &&
        prevProps.row.total_fte === nextProps.row.total_fte &&
        prevProps.indentLevel === nextProps.indentLevel &&
        prevProps.columns.length === nextProps.columns.length &&
        JSON.stringify(prevProps.row.allocations) === JSON.stringify(nextProps.row.allocations)
    );
});

RowItem.displayName = 'RowItem';
