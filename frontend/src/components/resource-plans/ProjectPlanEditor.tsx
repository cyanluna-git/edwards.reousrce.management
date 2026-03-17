import React, { useMemo, useRef, useState, useCallback, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useResourcePlans } from '@/hooks/useResourcePlans';
import { usePermissions } from '@/hooks/usePermissions';
import { createResourcePlan, updateResourcePlan, deleteResourcePlan, getResourcePlanHistory } from '@/api/client';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import type { ResourcePlanHistory } from '@/types';
import { MilestoneRow } from './MilestoneRow';

export interface ResourceRow {
    positionId: string;
    projectRoleId: string;
    positionName: string;
    userId?: string;
    userName?: string;
    isTbd: boolean;
    monthlyData: Record<string, { planId: number; hours: number }>;
}

interface ProjectPlanEditorProps {
    projectId: string;
    months: { year: number; month: number; label: string }[];
    onAddMember?: () => void;
    onDeleteRow?: (row: ResourceRow) => void;
    onDataChange?: (data: ResourceRow[]) => void;
    stickyTopOffset?: number;
}

/**
 * ProjectPlanEditor - Excel-style inline cell editing for resource plans.
 * Replaces ProjectResourceTable with direct in-cell editing (no modal needed).
 */
export const ProjectPlanEditor: React.FC<ProjectPlanEditorProps> = memo(({
    projectId,
    months,
    onAddMember,
    onDeleteRow,
    onDataChange,
    stickyTopOffset: _stickyTopOffset = 0,
}) => {
    const { t } = useTranslation('resource-plans');
    const { canManageResources } = usePermissions();
    const queryClient = useQueryClient();

    // Inline edit state
    const [editingCell, setEditingCell] = useState<{ rowKey: string; monthKey: string } | null>(null);
    // pendingValues: local override values while editing (rowKey → monthKey → value string)
    const [pendingValues, setPendingValues] = useState<Record<string, Record<string, string>>>({});
    // savingCells: set of "rowKey|monthKey" currently being saved
    const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
    // errorCells: set of "rowKey|monthKey" that failed to save
    const [errorCells, setErrorCells] = useState<Set<string>>(new Set());
    // History dialog
    const [historyRow, setHistoryRow] = useState<ResourceRow | null>(null);

    // 2D ref grid for keyboard navigation
    const cellRefs = useRef<Record<string, Record<string, HTMLInputElement | null>>>({});

    // Fetch resource plans for this project
    const { data: plans = [], isLoading, error } = useResourcePlans({ project_id: projectId });

    // Build rows from plans
    const rows = useMemo(() => {
        const rowMap: Record<string, ResourceRow> = {};

        plans.forEach(plan => {
            const displayRoleId = plan.project_role_id || plan.position_id || '';
            const displayRoleName = plan.project_role_name || plan.position_name || displayRoleId;
            const fRoleId = plan.position_id || '';
            const pRoleId = plan.project_role_id || '';
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

        return Object.values(rowMap);
    }, [plans]);

    // Notify parent when rows change (merge pendingValues so parent sees live values)
    React.useEffect(() => {
        if (!onDataChange) return;
        const liveRows = rows.map(row => {
            const displayRoleId = row.projectRoleId || row.positionId || '';
            const rowKey = `${displayRoleId}-${row.userId || 'TBD'}`;
            const rowPending = pendingValues[rowKey];
            if (!rowPending) return row;
            // Clone monthlyData with pending overrides
            const mergedMonthlyData: ResourceRow['monthlyData'] = { ...row.monthlyData };
            Object.entries(rowPending).forEach(([monthKey, pendingVal]) => {
                const parsedHours = parseFloat(pendingVal) || 0;
                const existing = row.monthlyData[monthKey];
                mergedMonthlyData[monthKey] = {
                    planId: existing?.planId ?? 0,
                    hours: parsedHours,
                };
            });
            return { ...row, monthlyData: mergedMonthlyData };
        });
        onDataChange(liveRows);
    }, [rows, pendingValues, onDataChange]);

    // History query
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

    // Helper: get display value for a cell (pending > committed)
    const getCellDisplayValue = useCallback((rowKey: string, monthKey: string, row: ResourceRow): string => {
        const pending = pendingValues[rowKey]?.[monthKey];
        if (pending !== undefined) return pending;
        const data = row.monthlyData[monthKey];
        return data ? String(data.hours) : '';
    }, [pendingValues]);

    // Register cell ref
    const registerCellRef = useCallback((rowKey: string, monthKey: string, el: HTMLInputElement | null) => {
        if (!cellRefs.current[rowKey]) cellRefs.current[rowKey] = {};
        cellRefs.current[rowKey][monthKey] = el;
    }, []);

    // Focus a cell by rowKey + monthKey
    const focusCell = useCallback((rowKey: string, monthKey: string) => {
        const el = cellRefs.current[rowKey]?.[monthKey];
        if (el) {
            el.focus();
            el.select();
        }
    }, []);

    // Handle cell focus (enter edit mode)
    const handleCellFocus = useCallback((rowKey: string, monthKey: string, row: ResourceRow) => {
        if (!canManageResources) return;
        setEditingCell({ rowKey, monthKey });
        // Initialize pending value from committed data
        const data = row.monthlyData[monthKey];
        const currentVal = data ? String(data.hours) : '';
        setPendingValues(prev => ({
            ...prev,
            [rowKey]: { ...(prev[rowKey] || {}), [monthKey]: currentVal },
        }));
    }, [canManageResources]);

    // Save a cell value on blur
    const handleCellBlur = useCallback(async (rowKey: string, monthKey: string, row: ResourceRow, inputValue: string) => {
        // Clear editing state
        setEditingCell(null);

        const cellId = `${rowKey}|${monthKey}`;
        const trimmed = inputValue.trim();
        const newValue = trimmed === '' ? null : parseFloat(trimmed);
        const isEmptyOrZero = newValue === null || newValue === 0;

        // Get original committed data
        const existingData = row.monthlyData[monthKey];
        const existingPlanId = existingData?.planId;
        const existingHours = existingData?.hours;

        // Determine operation
        let operation: 'create' | 'update' | 'delete' | 'noop' = 'noop';
        if (!existingPlanId) {
            if (!isEmptyOrZero) operation = 'create';
            // else: no plan, empty value → noop
        } else {
            if (isEmptyOrZero) {
                operation = 'delete';
            } else if (newValue !== existingHours) {
                operation = 'update';
            }
            // else: same value → noop
        }

        if (operation === 'noop') {
            // Clear pending value (revert to committed display)
            setPendingValues(prev => {
                const next = { ...prev };
                if (next[rowKey]) {
                    const rowVals = { ...next[rowKey] };
                    delete rowVals[monthKey];
                    if (Object.keys(rowVals).length === 0) {
                        delete next[rowKey];
                    } else {
                        next[rowKey] = rowVals;
                    }
                }
                return next;
            });
            return;
        }

        // Optimistic: keep pending value visible while saving
        setSavingCells(prev => new Set(prev).add(cellId));
        setErrorCells(prev => {
            const next = new Set(prev);
            next.delete(cellId);
            return next;
        });

        try {
            const [year, month] = monthKey.split('-').map(Number);

            if (operation === 'create') {
                await createResourcePlan({
                    project_id: projectId,
                    year,
                    month,
                    project_role_id: row.projectRoleId || undefined,
                    position_id: row.positionId || undefined,
                    user_id: row.userId,
                    planned_hours: newValue!,
                });
            } else if (operation === 'update') {
                await updateResourcePlan(existingPlanId!, { planned_hours: newValue! });
            } else if (operation === 'delete') {
                await deleteResourcePlan(existingPlanId!);
            }

            // Invalidate query to re-fetch fresh data
            queryClient.invalidateQueries({ queryKey: ['resource-plans'] });

            // Clear pending value (committed data will now reflect the new value after refetch)
            setPendingValues(prev => {
                const next = { ...prev };
                if (next[rowKey]) {
                    const rowVals = { ...next[rowKey] };
                    delete rowVals[monthKey];
                    if (Object.keys(rowVals).length === 0) {
                        delete next[rowKey];
                    } else {
                        next[rowKey] = rowVals;
                    }
                }
                return next;
            });
        } catch {
            // Rollback: show error state + restore original value
            setErrorCells(prev => new Set(prev).add(cellId));
            // Restore original value in pending
            const originalVal = existingData ? String(existingData.hours) : '';
            setPendingValues(prev => ({
                ...prev,
                [rowKey]: { ...(prev[rowKey] || {}), [monthKey]: originalVal },
            }));
        } finally {
            setSavingCells(prev => {
                const next = new Set(prev);
                next.delete(cellId);
                return next;
            });
        }
    }, [projectId, queryClient]);

    // Keyboard navigation handler
    const handleKeyDown = useCallback((
        e: React.KeyboardEvent<HTMLInputElement>,
        rowKey: string,
        monthKey: string,
        row: ResourceRow
    ) => {
        const rowKeys = rows.map(r => {
            const displayRoleId = r.projectRoleId || r.positionId || '';
            return `${displayRoleId}-${r.userId || 'TBD'}`;
        });
        const monthKeys = months.map(m => `${m.year}-${m.month}`);
        const rowIdx = rowKeys.indexOf(rowKey);
        const colIdx = monthKeys.indexOf(monthKey);

        const moveTo = (nextRow: number, nextCol: number) => {
            const targetRowKey = rowKeys[nextRow];
            const targetMonthKey = monthKeys[nextCol];
            if (targetRowKey && targetMonthKey) {
                e.preventDefault();
                // Blur current (triggers save), then focus next
                e.currentTarget.blur();
                setTimeout(() => focusCell(targetRowKey, targetMonthKey), 0);
            }
        };

        switch (e.key) {
            case 'Enter':
                moveTo(rowIdx + 1, colIdx);
                break;
            case 'Tab':
                if (e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.blur();
                    if (colIdx > 0) {
                        setTimeout(() => focusCell(rowKey, monthKeys[colIdx - 1]), 0);
                    } else if (rowIdx > 0) {
                        setTimeout(() => focusCell(rowKeys[rowIdx - 1], monthKeys[monthKeys.length - 1]), 0);
                    }
                } else {
                    e.preventDefault();
                    e.currentTarget.blur();
                    if (colIdx < monthKeys.length - 1) {
                        setTimeout(() => focusCell(rowKey, monthKeys[colIdx + 1]), 0);
                    } else if (rowIdx < rowKeys.length - 1) {
                        setTimeout(() => focusCell(rowKeys[rowIdx + 1], monthKeys[0]), 0);
                    }
                }
                break;
            case 'ArrowUp':
                moveTo(rowIdx - 1, colIdx);
                break;
            case 'ArrowDown':
                moveTo(rowIdx + 1, colIdx);
                break;
            case 'ArrowLeft':
                if (colIdx > 0) {
                    e.preventDefault();
                    e.currentTarget.blur();
                    setTimeout(() => focusCell(rowKey, monthKeys[colIdx - 1]), 0);
                }
                break;
            case 'ArrowRight':
                if (colIdx < monthKeys.length - 1) {
                    e.preventDefault();
                    e.currentTarget.blur();
                    setTimeout(() => focusCell(rowKey, monthKeys[colIdx + 1]), 0);
                }
                break;
            case 'Escape': {
                // Discard pending value, restore original
                const originalData = row.monthlyData[monthKey];
                const originalVal = originalData ? String(originalData.hours) : '';
                setPendingValues(prev => ({
                    ...prev,
                    [rowKey]: { ...(prev[rowKey] || {}), [monthKey]: originalVal },
                }));
                setEditingCell(null);
                e.currentTarget.blur();
                break;
            }
        }
    }, [rows, months, focusCell]);

    // Excel paste handler: fills multiple cells from tab/newline delimited clipboard
    const handlePaste = useCallback(async (
        e: React.ClipboardEvent<HTMLInputElement>,
        startRowKey: string,
        startMonthKey: string,
    ) => {
        const text = e.clipboardData.getData('text');
        // Only multi-cell paste needs special handling
        if (!text.includes('\t') && !text.includes('\n')) return;

        e.preventDefault();

        const rowKeys = rows.map(r => {
            const displayRoleId = r.projectRoleId || r.positionId || '';
            return `${displayRoleId}-${r.userId || 'TBD'}`;
        });
        const monthKeys = months.map(m => `${m.year}-${m.month}`);
        const startRowIdx = rowKeys.indexOf(startRowKey);
        const startColIdx = monthKeys.indexOf(startMonthKey);

        const pastedRows = text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .split('\n')
            .filter((_, i, arr) => i < arr.length - 1 || arr[i] !== ''); // remove trailing empty

        // Build list of (rowKey, monthKey, value) to save
        const cellUpdates: { rowKey: string; monthKey: string; value: string; row: ResourceRow }[] = [];

        pastedRows.forEach((rowText, rowOffset) => {
            const cols = rowText.split('\t');
            cols.forEach((cellText, colOffset) => {
                const targetRowIdx = startRowIdx + rowOffset;
                const targetColIdx = startColIdx + colOffset;
                if (targetRowIdx >= rowKeys.length || targetColIdx >= monthKeys.length) return;
                const targetRowKey = rowKeys[targetRowIdx];
                const targetMonthKey = monthKeys[targetColIdx];
                const targetRow = rows[targetRowIdx];
                if (!targetRow) return;
                cellUpdates.push({ rowKey: targetRowKey, monthKey: targetMonthKey, value: cellText.trim(), row: targetRow });
            });
        });

        if (cellUpdates.length === 0) return;

        // Apply all via blur-equivalent save logic
        await Promise.allSettled(
            cellUpdates.map(({ rowKey, monthKey, value, row }) => {
                // Set pending value first for optimistic display
                setPendingValues(prev => ({
                    ...prev,
                    [rowKey]: { ...(prev[rowKey] || {}), [monthKey]: value },
                }));
                return handleCellBlur(rowKey, monthKey, row, value);
            })
        );
    }, [rows, months, handleCellBlur]);

    // Loading / error states
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
        <div className="pb-3">
            <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-20">
                    <MilestoneRow projectId={projectId} months={months} />
                    <tr className="bg-slate-100">
                        <th className="text-left py-2 px-2 border-b sticky left-0 bg-slate-100 min-w-[160px] z-30 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                            {t('resourceTable.memberPosition')}
                        </th>
                        {months.map(m => (
                            <th key={m.label} className="bg-slate-100 text-center py-2 px-1 border-b min-w-[62px] text-xs whitespace-nowrap">
                                {m.label}
                            </th>
                        ))}
                        <th className="bg-slate-100 text-center py-2 px-2 border-b min-w-[80px]">{t('resourceTable.action')}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const displayRoleId = row.projectRoleId || row.positionId || '';
                        const rowKey = `${displayRoleId}-${row.userId || 'TBD'}`;

                        return (
                            <tr key={rowKey} className="border-b last:border-b-0 hover:bg-slate-50">
                                {/* Name / Position cell */}
                                <td className="py-2 px-2 sticky left-0 bg-white z-10 font-medium border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                                    <div className="flex flex-col">
                                        {row.isTbd
                                            ? <span className="italic text-slate-500">TBD</span>
                                            : <span>{row.userName}</span>
                                        }
                                        <span className="text-xs text-muted-foreground">{row.positionName}</span>
                                    </div>
                                </td>

                                {/* Monthly cells */}
                                {months.map(m => {
                                    const monthKey = `${m.year}-${m.month}`;
                                    const cellId = `${rowKey}|${monthKey}`;
                                    const isEditing = editingCell?.rowKey === rowKey && editingCell?.monthKey === monthKey;
                                    const isSaving = savingCells.has(cellId);
                                    const isError = errorCells.has(cellId);
                                    const displayVal = getCellDisplayValue(rowKey, monthKey, row);

                                    return (
                                        <td key={monthKey} className="text-center py-1 px-1 border-l text-xs">
                                            {canManageResources ? (
                                                <input
                                                    ref={el => registerCellRef(rowKey, monthKey, el)}
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="1"
                                                    className={[
                                                        'w-12 text-center text-xs rounded border px-1 py-0.5 bg-transparent',
                                                        'focus:outline-none',
                                                        isEditing
                                                            ? 'border-blue-500 ring-1 ring-blue-400 bg-white'
                                                            : isError
                                                                ? 'border-red-500 ring-1 ring-red-400'
                                                                : isSaving
                                                                    ? 'border-slate-300 opacity-60'
                                                                    : 'border-transparent hover:border-slate-300',
                                                    ].join(' ')}
                                                    value={displayVal}
                                                    onChange={e => {
                                                        setPendingValues(prev => ({
                                                            ...prev,
                                                            [rowKey]: { ...(prev[rowKey] || {}), [monthKey]: e.target.value },
                                                        }));
                                                    }}
                                                    onFocus={() => handleCellFocus(rowKey, monthKey, row)}
                                                    onBlur={e => handleCellBlur(rowKey, monthKey, row, e.target.value)}
                                                    onKeyDown={e => handleKeyDown(e, rowKey, monthKey, row)}
                                                    onPaste={e => handlePaste(e, rowKey, monthKey)}
                                                    placeholder="-"
                                                    disabled={isSaving}
                                                    title={isError ? t('editor.saveError') : undefined}
                                                />
                                            ) : (
                                                // Read-only display
                                                <span className="text-slate-700">
                                                    {displayVal || '-'}
                                                </span>
                                            )}
                                        </td>
                                    );
                                })}

                                {/* Action cell */}
                                <td className="text-center py-2 px-2">
                                    <div className="flex justify-center gap-1">
                                        <button
                                            className="text-xs text-slate-600 hover:underline px-1"
                                            onClick={() => setHistoryRow(row)}
                                        >
                                            {t('actions.viewHistory')}
                                        </button>
                                        {onDeleteRow && canManageResources && (
                                            <button
                                                className="text-xs text-red-600 hover:underline px-1"
                                                onClick={() => onDeleteRow(row)}
                                            >
                                                {t('actions.deleteRow')}
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}

                    {/* Totals Row */}
                    <tr className="bg-slate-50 font-semibold text-xs border-t-2">
                        <td className="py-2 px-2 sticky left-0 bg-slate-50 z-10 text-right border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                            {t('table.total')}
                        </td>
                        {months.map(m => {
                            const monthKey = `${m.year}-${m.month}`;
                            const total = rows.reduce((sum, r) => {
                                // Use pending value if present, otherwise committed
                                const displayRoleId2 = r.projectRoleId || r.positionId || '';
                                const rKey = `${displayRoleId2}-${r.userId || 'TBD'}`;
                                const pending = pendingValues[rKey]?.[monthKey];
                                const val = pending !== undefined
                                    ? (parseFloat(pending) || 0)
                                    : (r.monthlyData[monthKey]?.hours || 0);
                                return sum + val;
                            }, 0);
                            return (
                                <td key={monthKey} className="text-center py-2 px-1 border-l">
                                    {total > 0 ? total.toFixed(1).replace(/\.0$/, '') : '-'}
                                </td>
                            );
                        })}
                        <td></td>
                    </tr>
                </tbody>
            </table>

            {/* History Dialog */}
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
