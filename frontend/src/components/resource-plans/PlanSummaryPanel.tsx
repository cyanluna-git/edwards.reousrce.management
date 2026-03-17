import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ResourcePlan } from '@/types';
import type { ResourceRow } from './ProjectPlanEditor';

interface PlanSummaryPanelProps {
    rows: ResourceRow[];
    months: { year: number; month: number; label: string }[];
    allPlans?: ResourcePlan[];
    currentProjectId?: string;
}

type SubTab = 'member' | 'role';

const STORAGE_KEY = 'rp-summary-panel-collapsed';
const HEIGHT_KEY = 'rp-summary-panel-height';
const DEFAULT_HEIGHT = 200;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 600;

function getInitialCollapsed(): boolean {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'true';
    } catch {
        return false;
    }
}

function FteCell({ value }: { value: number }) {
    if (value === 0) {
        return <span className="text-slate-300">-</span>;
    }
    if (value > 1.0) {
        return <span className="text-red-600 font-bold">{value.toFixed(1).replace(/\.0$/, '')}</span>;
    }
    return <span>{value.toFixed(1).replace(/\.0$/, '')}</span>;
}

function FteCellWithBreakdown({ total, current }: { total: number; current: number }) {
    if (total === 0 && current === 0) {
        return <span className="text-slate-300">-</span>;
    }

    const hasOtherProjects = Math.abs(total - current) > 0.001;

    return (
        <div className="flex flex-col items-center leading-tight">
            <span className={total > 1.0 ? 'text-red-600 font-bold' : ''}>
                {total.toFixed(1).replace(/\.0$/, '')}
            </span>
            {hasOtherProjects && (
                <span className="text-[10px] text-slate-400 leading-none">
                    ({current.toFixed(1).replace(/\.0$/, '')})
                </span>
            )}
        </div>
    );
}

export const PlanSummaryPanel: React.FC<PlanSummaryPanelProps> = ({ rows, months, allPlans }) => {
    const { t } = useTranslation('resource-plans');
    const [collapsed, setCollapsed] = useState(getInitialCollapsed);
    const [subTab, setSubTab] = useState<SubTab>('member');
    const [panelHeight, setPanelHeight] = useState<number>(() => {
        try {
            const stored = localStorage.getItem(HEIGHT_KEY);
            return stored ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Number(stored))) : DEFAULT_HEIGHT;
        } catch {
            return DEFAULT_HEIGHT;
        }
    });
    const dragStartY = useRef<number | null>(null);
    const dragStartHeight = useRef<number>(DEFAULT_HEIGHT);

    const toggleCollapsed = () => {
        setCollapsed(prev => {
            const next = !prev;
            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch {
                // ignore storage errors
            }
            return next;
        });
    };

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragStartY.current = e.clientY;
        dragStartHeight.current = panelHeight;

        const onMouseMove = (ev: MouseEvent) => {
            if (dragStartY.current === null) return;
            const delta = ev.clientY - dragStartY.current;
            const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartHeight.current + delta));
            setPanelHeight(newHeight);
        };

        const onMouseUp = (ev: MouseEvent) => {
            const delta = ev.clientY - (dragStartY.current ?? ev.clientY);
            const finalHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartHeight.current + delta));
            dragStartY.current = null;
            try { localStorage.setItem(HEIGHT_KEY, String(finalHeight)); } catch { /* ignore */ }
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [panelHeight]);

    const monthKeys = useMemo(() => months.map(m => `${m.year}-${m.month}`), [months]);

    // Build a lookup: userId -> monthKey -> total FTE across all projects
    const crossProjectFteMap = useMemo(() => {
        const map: Record<string, Record<string, number>> = {};
        if (!allPlans || allPlans.length === 0) return map;

        for (const plan of allPlans) {
            if (!plan.user_id) continue; // Skip TBD rows
            const mk = `${plan.year}-${plan.month}`;
            if (!map[plan.user_id]) {
                map[plan.user_id] = {};
            }
            map[plan.user_id][mk] = (map[plan.user_id][mk] || 0) + plan.planned_hours;
        }
        return map;
    }, [allPlans]);

    // By Member: each row with cross-project FTE totals and current-project values
    // Sort by role then name so order stays stable when cell values change
    const memberRows = useMemo(() => {
        return [...rows].sort((a, b) => {
            const roleA = a.positionName ?? '';
            const roleB = b.positionName ?? '';
            if (roleA !== roleB) return roleA.localeCompare(roleB);
            const nameA = a.isTbd ? '\uFFFF' : (a.userName ?? '');
            const nameB = b.isTbd ? '\uFFFF' : (b.userName ?? '');
            return nameA.localeCompare(nameB);
        }).map(row => {
            const currentMonthValues = monthKeys.map(mk => row.monthlyData[mk]?.hours ?? 0);
            const isTbd = row.isTbd || !row.userId;

            // For TBD rows or when allPlans not loaded, fall back to current-project values
            const totalMonthValues = monthKeys.map((mk, idx) => {
                if (isTbd || !row.userId || !crossProjectFteMap[row.userId]) {
                    return currentMonthValues[idx];
                }
                return crossProjectFteMap[row.userId][mk] ?? 0;
            });

            const total = totalMonthValues.reduce((a, b) => a + b, 0);
            const currentTotal = currentMonthValues.reduce((a, b) => a + b, 0);

            return {
                key: `${row.projectRoleId || row.positionId || ''}-${row.userId || 'TBD'}`,
                name: isTbd ? 'TBD' : (row.userName ?? 'TBD'),
                role: row.positionName,
                totalMonthValues,
                currentMonthValues,
                total,
                currentTotal,
                isTbd,
            };
        });
    }, [rows, monthKeys, crossProjectFteMap]);

    // By Role: group rows by positionName, sum cross-project FTE totals
    const roleRows = useMemo(() => {
        const groupMap: Record<string, { totalMonthValues: number[]; currentMonthValues: number[]; total: number; currentTotal: number }> = {};

        memberRows.forEach(mr => {
            const roleName = mr.role || 'Unknown';
            if (!groupMap[roleName]) {
                groupMap[roleName] = {
                    totalMonthValues: new Array(monthKeys.length).fill(0),
                    currentMonthValues: new Array(monthKeys.length).fill(0),
                    total: 0,
                    currentTotal: 0,
                };
            }
            monthKeys.forEach((_mk, idx) => {
                groupMap[roleName].totalMonthValues[idx] += mr.totalMonthValues[idx];
                groupMap[roleName].currentMonthValues[idx] += mr.currentMonthValues[idx];
            });
            groupMap[roleName].total += mr.total;
            groupMap[roleName].currentTotal += mr.currentTotal;
        });

        return Object.entries(groupMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([roleName, data]) => ({
                key: roleName,
                role: roleName,
                totalMonthValues: data.totalMonthValues,
                currentMonthValues: data.currentMonthValues,
                total: data.total,
                currentTotal: data.currentTotal,
            }));
    }, [memberRows, monthKeys]);

    if (rows.length === 0) return null;

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            {/* Header */}
            <button
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                onClick={toggleCollapsed}
                aria-expanded={!collapsed}
            >
                <span>{t('planSummary.title')}</span>
                {collapsed
                    ? <ChevronDown className="h-4 w-4 text-slate-400" />
                    : <ChevronUp className="h-4 w-4 text-slate-400" />
                }
            </button>

            {!collapsed && (
                <div className="border-t border-slate-100">
                    {/* Sub-tab buttons */}
                    <div className="flex gap-1 px-4 pt-2 pb-1">
                        <button
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${subTab === 'member'
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-slate-500 hover:bg-slate-100'
                                }`}
                            onClick={() => setSubTab('member')}
                        >
                            {t('planSummary.byMember')}
                        </button>
                        <button
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${subTab === 'role'
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-slate-500 hover:bg-slate-100'
                                }`}
                            onClick={() => setSubTab('role')}
                        >
                            {t('planSummary.byRole')}
                        </button>
                    </div>

                    {/* Table — scrollable, fixed height */}
                    <div className="overflow-auto px-3" style={{ height: panelHeight }}>
                        <table className="w-full text-xs border-collapse">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-slate-50">
                                    <th className="sticky left-0 z-30 bg-slate-50 text-left py-1.5 px-2 border-b font-medium text-slate-600 min-w-[160px] border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                                        {subTab === 'member' ? t('planSummary.member') : t('planSummary.role')}
                                    </th>
                                    {months.map(m => (
                                        <th
                                            key={`${m.year}-${m.month}`}
                                            className="bg-slate-50 text-center py-1.5 px-1 border-b font-medium text-slate-600 min-w-[62px] whitespace-nowrap"
                                        >
                                            {m.label}
                                        </th>
                                    ))}
                                    <th className="bg-slate-50 text-center py-1.5 px-2 border-b font-medium text-slate-600 min-w-[50px]">
                                        {t('planSummary.total')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {subTab === 'member'
                                    ? memberRows.map(mr => (
                                        <tr key={mr.key} className="border-b last:border-b-0 hover:bg-slate-50">
                                            <td className="sticky left-0 z-10 bg-white py-1 px-2 border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                                                <div className="font-medium text-slate-700 leading-tight">{mr.name}</div>
                                                {mr.role && <div className="text-[11px] text-slate-400 leading-tight">{mr.role}</div>}
                                            </td>
                                            {mr.totalMonthValues.map((val, idx) => (
                                                <td key={monthKeys[idx]} className="text-center py-1 px-1 border-l">
                                                    {mr.isTbd ? (
                                                        <FteCell value={val} />
                                                    ) : (
                                                        <FteCellWithBreakdown
                                                            total={val}
                                                            current={mr.currentMonthValues[idx]}
                                                        />
                                                    )}
                                                </td>
                                            ))}
                                            <td className="text-center py-1 px-2 border-l font-semibold">
                                                {mr.isTbd ? (
                                                    <FteCell value={mr.total} />
                                                ) : (
                                                    <FteCellWithBreakdown
                                                        total={mr.total}
                                                        current={mr.currentTotal}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                    : roleRows.map(rr => (
                                        <tr key={rr.key} className="border-b last:border-b-0 hover:bg-slate-50">
                                            <td className="sticky left-0 z-10 bg-white py-1 px-2 font-medium text-slate-700 border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                                                {rr.role}
                                            </td>
                                            {rr.totalMonthValues.map((val, idx) => (
                                                <td key={monthKeys[idx]} className="text-center py-1 px-1 border-l">
                                                    <FteCellWithBreakdown
                                                        total={val}
                                                        current={rr.currentMonthValues[idx]}
                                                    />
                                                </td>
                                            ))}
                                            <td className="text-center py-1 px-2 border-l font-semibold">
                                                <FteCellWithBreakdown
                                                    total={rr.total}
                                                    current={rr.currentTotal}
                                                />
                                            </td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>

                    {/* Drag resize handle */}
                    <div
                        className="h-2 flex items-center justify-center cursor-row-resize hover:bg-slate-100 rounded-b-lg group"
                        onMouseDown={handleDragStart}
                        title="Drag to resize"
                    >
                        <div className="w-8 h-0.5 rounded-full bg-slate-300 group-hover:bg-slate-400 transition-colors" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlanSummaryPanel;
