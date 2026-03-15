import React, { useMemo, memo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useResourcePlans } from '@/hooks/useResourcePlans';
import { getResourcePlanHistory } from '@/api/client';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import type { ResourcePlanHistory } from '@/types';

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
    onAddMember?: () => void;
    onEditRow?: (row: ResourceRow) => void;
    onDeleteRow?: (row: ResourceRow) => void;
}

// Memoized to prevent re-renders when parent state changes but props are same
export const ProjectResourceTable: React.FC<ProjectResourceTableProps> = memo(({
    projectId,
    months,
    onAddMember,
    onEditRow,
    onDeleteRow,
}) => {
    const { t } = useTranslation('resource-plans');
    const [historyRow, setHistoryRow] = useState<ResourceRow | null>(null);

    // Lazy Load: Fetch only when this component is mounted
    const { data: plans = [], isLoading, error } = useResourcePlans({ project_id: projectId });
    const { data: historyEntries = [], isLoading: isHistoryLoading, error: historyError } = useQuery<ResourcePlanHistory[], Error>({
        queryKey: [
            'resource-plan-history',
            projectId,
            historyRow?.positionId,
            historyRow?.projectRoleId || null,
            historyRow?.userId || null,
            historyRow?.isTbd || false,
        ],
        queryFn: () =>
            getResourcePlanHistory({
                project_id: projectId,
                position_id: historyRow!.positionId,
                project_role_id: historyRow?.projectRoleId || undefined,
                user_id: historyRow?.userId || undefined,
                is_tbd: historyRow?.isTbd,
                limit: 100,
            }),
        enabled: Boolean(historyRow),
    });

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
        return <div className="p-4 text-center text-sm text-gray-500">{t('resourceTable.loading')}</div>;
    }

    if (error) {
        return (
            <div className="p-4 text-center text-sm text-red-500">
                {t('resourceTable.loadError', { message: (error as Error).message })}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="p-4 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
                <span>{t('resourceTable.noMembers')}</span>
                {onAddMember && (
                    <Button size="sm" variant="outline" onClick={onAddMember}>
                        {t('actions.addRow')}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="px-3 pb-3 overflow-x-auto">
            {onAddMember && (
                <div className="flex justify-end p-2">
                    <Button size="sm" variant="outline" onClick={onAddMember}>
                        {t('actions.addRow')}
                    </Button>
                </div>
            )}
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100 min-w-[160px] z-10">
                            {t('resourceTable.memberPosition')}
                        </th>
                        {months.map(m => (
                            <th key={m.label} className="text-center py-2 px-1 border-b min-w-[50px] text-xs">
                                {m.label}
                            </th>
                        ))}
                        <th className="text-center py-2 px-2 border-b min-w-[80px]">{t('resourceTable.action')}</th>
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
                                {(onEditRow || onDeleteRow) && (
                                    <div className="flex justify-center gap-1">
                                        {onEditRow && (
                                            <button
                                                className="text-xs text-blue-600 hover:underline px-1"
                                                onClick={() => onEditRow(row)}
                                            >
                                                {t('actions.editRow')}
                                            </button>
                                        )}
                                        <button
                                            className="text-xs text-slate-600 hover:underline px-1"
                                            onClick={() => setHistoryRow(row)}
                                        >
                                            {t('actions.viewHistory')}
                                        </button>
                                        {onDeleteRow && (
                                            <button
                                                className="text-xs text-red-600 hover:underline px-1"
                                                onClick={() => onDeleteRow(row)}
                                            >
                                                {t('actions.deleteRow')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-slate-50 font-semibold text-xs border-t-2">
                        <td className="py-2 px-2 sticky left-0 bg-slate-50 z-10 text-right">
                            {t('table.total')}
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

            <Dialog open={Boolean(historyRow)} onOpenChange={(open) => !open && setHistoryRow(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            {t('history.title', { name: historyRow?.userName || 'TBD' })}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {isHistoryLoading && (
                            <div className="text-sm text-slate-500">{t('history.loading')}</div>
                        )}

                        {historyError && (
                            <div className="text-sm text-red-600">
                                {t('history.loadError', { message: historyError.message })}
                            </div>
                        )}

                        {!isHistoryLoading && !historyError && historyEntries.length === 0 && (
                            <div className="text-sm text-slate-500">{t('history.empty')}</div>
                        )}

                        {!isHistoryLoading && !historyError && historyEntries.map((entry) => (
                            <article key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-slate-900">
                                        {t(`history.changeTypes.${entry.change_type.toLowerCase()}`)}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {entry.year}-{String(entry.month).padStart(2, '0')} · {entry.created_at ? new Date(entry.created_at).toLocaleString() : '-'}
                                    </div>
                                </div>
                                <p className="mt-1 text-sm text-slate-600">
                                    {t('history.actor', { name: entry.actor_user_name })}
                                </p>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <div className="rounded border border-slate-200 bg-white p-3">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            {t('history.before')}
                                        </div>
                                        <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-700">
                                            {JSON.stringify(entry.before_values, null, 2) || '-'}
                                        </pre>
                                    </div>
                                    <div className="rounded border border-slate-200 bg-white p-3">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            {t('history.after')}
                                        </div>
                                        <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-700">
                                            {JSON.stringify(entry.after_values, null, 2) || '-'}
                                        </pre>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
});
