import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui';
import { getMatrixDetails } from '@/api/client';
import { Loader2 } from 'lucide-react';

interface WorklogDrilldownModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    month: string; // YYYY-MM
    ioId: string;
    ioName: string;
}

export const WorklogDrilldownModal: React.FC<WorklogDrilldownModalProps> = ({
    isOpen,
    onClose,
    userId,
    userName,
    month,
    ioId,
    ioName,
}) => {
    // Determine IO Label from IO Name/ID (optional formatting)
    const displayIo = ioName || ioId;

    // Fetch Details
    const { data: worklogs = [], isLoading, error } = useQuery({
        queryKey: ['matrix-details', userId, month, ioId],
        queryFn: () => getMatrixDetails(userId, month, ioId),
        enabled: isOpen && !!userId && !!month && !!ioId,
    });

    // Calculate Totals
    const totalHours = useMemo(() => worklogs.reduce((sum, log) => sum + log.hours, 0), [worklogs]);
    // Note: FTE here depends on the denominator used in the backend. 
    // Backend returns "fte_contribution" per log which is (hours / user_total_project_hours_in_month).
    // So summing them up gives the cell's FTE value.
    const totalFte = useMemo(() => worklogs.reduce((sum, log) => sum + log.fte_contribution, 0), [worklogs]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Allocation Details</DialogTitle>
                    <DialogDescription>
                        {userName} • {month} • {displayIo}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto min-h-[300px] mt-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            Loading worklogs...
                        </div>
                    ) : error ? (
                        <div className="text-red-500 p-4 text-center">
                            Failed to load details. Please try again.
                        </div>
                    ) : worklogs.length === 0 ? (
                        <div className="text-slate-500 p-8 text-center bg-slate-50 rounded-lg">
                            No worklogs found for this selection.
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-600 sticky top-0 shadow-sm">
                                <tr>
                                    <th className="p-3 font-semibold w-24">Date</th>
                                    <th className="p-3 font-semibold">Project</th>
                                    <th className="p-3 font-semibold">Description</th>
                                    <th className="p-3 font-semibold text-right w-20">Hours</th>
                                    <th className="p-3 font-semibold text-right w-20">FTE</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {worklogs.map((log, idx) => (
                                    <tr key={`${log.date}-${idx}`} className="hover:bg-slate-50">
                                        <td className="p-3 text-slate-500 font-mono text-xs">
                                            {log.date}
                                        </td>
                                        <td className="p-3 font-medium text-slate-700">
                                            <div>{log.project_name}</div>
                                            {log.io_number && log.io_number !== "N/A" && (
                                                <div className="text-[10px] text-slate-400">{log.io_number}</div>
                                            )}
                                        </td>
                                        <td className="p-3 text-slate-600 max-w-xs truncate" title={log.description || ''}>
                                            {log.description || '-'}
                                        </td>
                                        <td className="p-3 text-right font-mono text-slate-700">
                                            {log.hours.toFixed(1)}
                                        </td>
                                        <td className="p-3 text-right font-mono text-blue-600 font-medium">
                                            {log.fte_contribution.toFixed(3)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 font-semibold text-slate-800 sticky bottom-0 border-t">
                                <tr>
                                    <td colSpan={3} className="p-3 text-right">Total</td>
                                    <td className="p-3 text-right">{totalHours.toFixed(1)} h</td>
                                    <td className="p-3 text-right text-blue-700">{totalFte.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
