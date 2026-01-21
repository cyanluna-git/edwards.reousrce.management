/**
 * ResourceAllocationGrid - Master Headcount Sheet
 * Shows resource allocation by Program > Project > Month with individual details
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getResourceAllocationMatrix,
    type ResourceAllocationDetail,
    type ResourceAllocationMatrix,
} from '@/api/client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui';

interface ResourceAllocationGridProps {
    startMonth: string;
    endMonth: string;
    departmentId?: string;
    programId?: string;
}

export const ResourceAllocationGrid: React.FC<ResourceAllocationGridProps> = ({
    startMonth,
    endMonth,
    departmentId,
    programId,
}) => {
    const { data, isLoading, error } = useQuery<ResourceAllocationMatrix>({
        queryKey: ['resource-matrix', startMonth, endMonth, departmentId, programId],
        queryFn: () => getResourceAllocationMatrix(startMonth, endMonth, departmentId, programId),
        enabled: !!startMonth && !!endMonth,
    });

    const [selectedCell, setSelectedCell] = useState<{
        project: string;
        month: string;
        details: ResourceAllocationDetail[];
    } | null>(null);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-lg text-muted-foreground">Loading resource matrix...</div>
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

    if (!data || data.programs.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-lg text-muted-foreground">
                    No resource allocations found for the selected period.
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-auto max-h-[calc(100vh-300px)] border rounded-lg">
                <table className="border-collapse w-full text-sm">
                    {/* Sticky Header */}
                    <thead className="sticky top-0 bg-slate-100 z-20 shadow-sm">
                        <tr>
                            <th className="sticky left-0 bg-slate-200 border border-slate-300 p-3 min-w-[280px] text-left font-semibold z-30">
                                Program / Project
                            </th>
                            {data.months.map((month) => (
                                <th
                                    key={month}
                                    className="border border-slate-300 p-2 min-w-[110px] font-semibold"
                                >
                                    {month}
                                </th>
                            ))}
                            <th className="border border-slate-300 p-2 bg-blue-50 font-semibold min-w-[90px]">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.programs.map((program) => (
                            <React.Fragment key={program.program_id}>
                                {/* Program Header Row */}
                                <tr className="bg-slate-100 font-bold hover:bg-slate-150">
                                    <td className="sticky left-0 bg-slate-100 border border-slate-300 p-3 z-10">
                                        <div className="flex items-center gap-2">
                                            <span className="text-blue-700">▼</span>
                                            <span className="text-slate-800">{program.program_name}</span>
                                        </div>
                                    </td>
                                    {data.months.map((month) => (
                                        <td
                                            key={month}
                                            className="border border-slate-300 p-2 text-right font-semibold"
                                        >
                                            {program.total_by_month[month]?.toFixed(1) || '0.0'}
                                        </td>
                                    ))}
                                    <td className="border border-slate-300 p-2 text-right bg-blue-50 font-semibold">
                                        {Object.values(program.total_by_month)
                                            .reduce((a, b) => a + b, 0)
                                            .toFixed(1)}
                                    </td>
                                </tr>

                                {/* Project Rows */}
                                {program.projects.map((project) => (
                                    <tr
                                        key={project.project_id}
                                        className="hover:bg-slate-50 transition-colors"
                                    >
                                        <td className="sticky left-0 bg-white border border-slate-300 p-3 pl-8 z-10">
                                            <div className="space-y-0.5">
                                                <div className="text-xs text-slate-500 font-mono">
                                                    {project.project_code}
                                                </div>
                                                <div className="text-sm font-medium text-slate-800">
                                                    {project.project_name}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {project.category}
                                                </div>
                                            </div>
                                        </td>
                                        {data.months.map((month) => {
                                            const allocation = project.allocations[month];
                                            const hasPeople = allocation && allocation.total_fte > 0;

                                            return (
                                                <td
                                                    key={month}
                                                    className={`border border-slate-300 p-2 text-right ${
                                                        hasPeople
                                                            ? 'cursor-pointer hover:bg-blue-50 hover:shadow-inner'
                                                            : 'bg-slate-50'
                                                    }`}
                                                    onClick={() => {
                                                        if (hasPeople) {
                                                            setSelectedCell({
                                                                project: project.project_name,
                                                                month,
                                                                details: allocation.details,
                                                            });
                                                        }
                                                    }}
                                                >
                                                    {hasPeople ? (
                                                        <div className="space-y-0.5">
                                                            <div className="font-semibold text-blue-700">
                                                                {allocation.total_fte.toFixed(1)}
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                ({allocation.details.length}{' '}
                                                                {allocation.details.length === 1
                                                                    ? 'person'
                                                                    : 'people'}
                                                                )
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="border border-slate-300 p-2 text-right bg-slate-50 font-medium">
                                            {Object.values(project.allocations)
                                                .reduce((sum, a) => sum + a.total_fte, 0)
                                                .toFixed(1)}
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}

                        {/* Grand Total Row */}
                        <tr className="bg-blue-100 font-bold sticky bottom-0 z-10 shadow-sm">
                            <td className="sticky left-0 bg-blue-200 border border-slate-300 p-3 z-20 text-blue-900">
                                GRAND TOTAL
                            </td>
                            {data.months.map((month) => (
                                <td
                                    key={month}
                                    className="border border-slate-300 p-2 text-right text-blue-900"
                                >
                                    {data.grand_total_by_month[month]?.toFixed(1) || '0.0'}
                                </td>
                            ))}
                            <td className="border border-slate-300 p-2 text-right bg-blue-200 text-blue-900">
                                {Object.values(data.grand_total_by_month)
                                    .reduce((a, b) => a + b, 0)
                                    .toFixed(1)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            {selectedCell && (
                <CellDetailModal
                    project={selectedCell.project}
                    month={selectedCell.month}
                    details={selectedCell.details}
                    onClose={() => setSelectedCell(null)}
                />
            )}
        </>
    );
};

interface CellDetailModalProps {
    project: string;
    month: string;
    details: ResourceAllocationDetail[];
    onClose: () => void;
}

const CellDetailModal: React.FC<CellDetailModalProps> = ({
    project,
    month,
    details,
    onClose,
}) => {
    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {project} - {month}
                    </DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b bg-slate-50">
                                <th className="text-left p-3 font-semibold">Name</th>
                                <th className="text-left p-3 font-semibold">Role</th>
                                <th className="text-left p-3 font-semibold">Position</th>
                                <th className="text-right p-3 font-semibold">FTE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {details.map((detail, index) => (
                                <tr key={index} className="border-b hover:bg-slate-50">
                                    <td className="p-3">
                                        {detail.user_id ? (
                                            <span className="font-medium">{detail.name}</span>
                                        ) : (
                                            <span className="text-slate-400 italic">
                                                {detail.name}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-slate-600">{detail.role}</td>
                                    <td className="p-3 text-slate-600">{detail.position}</td>
                                    <td className="p-3 text-right font-mono font-semibold text-blue-700">
                                        {detail.fte.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="font-bold bg-blue-50 border-t-2 border-blue-200">
                                <td colSpan={3} className="p-3 text-blue-900">
                                    Total FTE
                                </td>
                                <td className="p-3 text-right font-mono text-lg text-blue-900">
                                    {details.reduce((sum, d) => sum + d.fte, 0).toFixed(2)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ResourceAllocationGrid;
