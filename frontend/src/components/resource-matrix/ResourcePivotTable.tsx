/**
 * ResourcePivotTable - Master Headcount Pivot Sheet
 * Shows resource allocation by User x IO (Internal/Recharge)
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getResourcePivotMatrix,
    type PivotMatrixResponse,
} from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ResourcePivotTableProps {
    startMonth: string;
    endMonth: string;
    departmentId?: string;
    programId?: string;
}

export const ResourcePivotTable: React.FC<ResourcePivotTableProps> = ({
    startMonth,
    endMonth,
    departmentId,
    programId,
}) => {
    const { data, isLoading, error } = useQuery<PivotMatrixResponse>({
        queryKey: ['resource-pivot', startMonth, endMonth, departmentId, programId],
        queryFn: () => getResourcePivotMatrix(startMonth, endMonth, departmentId, programId),
        enabled: !!startMonth && !!endMonth,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-lg text-muted-foreground">Loading pivot matrix...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-lg text-red-600">
                    Error loading data: {error instanceof Error ? error.message : 'Unknown error'}
                </div>
            </div>
        );
    }

    if (!data || data.rows.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-lg text-muted-foreground">
                    No resource allocations found for the selected period.
                </div>
            </div>
        );
    }

    // IO Type Badge Helper
    const getIOBadge = (type: string) => {
        switch (type) {
            case 'INTERNAL':
                return <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-200">INT</Badge>;
            case 'RECHARGE':
                return <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 hover:bg-green-200">RCH</Badge>;
            default:
                return null;
        }
    };

    return (
        <div className="overflow-auto max-h-[calc(100vh-300px)] border rounded-lg shadow-sm">
            <table className="border-collapse w-full text-sm">
                {/* Sticky Header */}
                <thead className="sticky top-0 bg-slate-50 z-20 shadow-sm">
                    <tr>
                        {/* User Column (Sticky Left) */}
                        <th className="sticky left-0 bg-slate-100 border border-slate-300 p-3 min-w-[200px] text-left font-bold z-30 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                            <div className="flex flex-col">
                                <span className="text-slate-800">Resource</span>
                                <span className="text-xs text-slate-500 font-normal">Name / Position</span>
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
                                </div>
                            </th>
                        ))}

                        {/* Total Column */}
                        <th className="sticky right-0 bg-blue-50 border border-slate-300 p-2 min-w-[80px] font-bold text-blue-900 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)] z-20">
                            Total
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {/* User Rows */}
                    {data.rows.map((row) => (
                        <tr key={row.user_id || 'tbd'} className="hover:bg-slate-50 transition-colors">
                            {/* User Info (Sticky Left) */}
                            <td className="sticky left-0 bg-white border border-slate-300 p-3 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                                <div className="flex flex-col">
                                    <span className="font-medium text-slate-800">{row.user_name}</span>
                                    {row.position_name && (
                                        <span className="text-xs text-slate-500">{row.position_name}</span>
                                    )}
                                </div>
                            </td>

                            {/* IO Cells */}
                            {data.columns.map((col) => {
                                const val = row.allocations[col.id] || 0;
                                return (
                                    <td
                                        key={`${row.user_id}-${col.id}`}
                                        className={cn(
                                            "border border-slate-300 p-2 text-right font-mono text-sm",
                                            val > 0 ? "text-slate-800" : "text-slate-300"
                                        )}
                                    >
                                        {val > 0 ? val.toFixed(2) : '-'}
                                    </td>
                                );
                            })}

                            {/* Row Total (Sticky Right) */}
                            <td className="sticky right-0 bg-blue-50 border border-slate-300 p-2 text-right font-bold text-blue-900 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)] z-10">
                                {row.total_fte.toFixed(1)}
                            </td>
                        </tr>
                    ))}
                </tbody>

                {/* Grand Total Footer */}
                <tfoot className="sticky bottom-0 z-20">
                    <tr className="bg-blue-100 font-bold shadow-md">
                        <td className="sticky left-0 bg-blue-200 border border-slate-300 p-3 text-blue-900 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] z-30">
                            GRAND TOTAL
                        </td>
                        {data.columns.map((col) => (
                            <td key={col.id} className="border border-slate-300 p-2 text-right text-blue-900 bg-blue-100">
                                {col.total_fte.toFixed(1)}
                            </td>
                        ))}
                        <td className="sticky right-0 bg-blue-300 border border-slate-300 p-2 text-right text-blue-950 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)] z-30">
                            {data.grand_total.toFixed(1)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};
