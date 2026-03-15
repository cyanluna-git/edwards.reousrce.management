/**
 * Weekly Calendar Grid Component
 * Displays worklogs in a 7-day grid format
 */
import React, { useState } from 'react';
import { format, addDays, isToday } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, getLocalizedName } from '@/lib/utils';
import type { WorkLog } from '@/types';

interface WeeklyCalendarGridProps {
    weekStart: Date;
    worklogs: WorkLog[];
    onCellClick: (date: string) => void;
    onWorklogEdit: (worklog: WorkLog) => void;
    onWorklogDelete: (worklogId: number) => void;
    onWorklogMove?: (worklog: WorkLog, targetDate: string) => Promise<void> | void;
    onAIInputClick?: (date: string) => void;
    movingWorklogId?: number | null;
}

export const WeeklyCalendarGrid: React.FC<WeeklyCalendarGridProps> = ({
    weekStart,
    worklogs,
    onCellClick,
    onWorklogEdit,
    onWorklogDelete,
    onWorklogMove,
    onAIInputClick,
    movingWorklogId = null,
}) => {
    const { t, i18n } = useTranslation('worklogs');
    const [draggedWorklog, setDraggedWorklog] = useState<{ id: number; sourceDate: string } | null>(null);
    const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
    const DAYS = [
        t('calendar.dayMon'), t('calendar.dayTue'), t('calendar.dayWed'),
        t('calendar.dayThu'), t('calendar.dayFri'), t('calendar.daySat'), t('calendar.daySun'),
    ];
    // Generate dates for the week (Monday to Sunday)
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    // Group worklogs by date
    const worklogsByDate = worklogs.reduce<Record<string, WorkLog[]>>((acc, wl) => {
        const dateKey = typeof wl.date === 'string' ? wl.date.split('T')[0] : wl.date;
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(wl);
        return acc;
    }, {});

    // Calculate daily totals
    const getDailyTotal = (dateStr: string): number => {
        const logs = worklogsByDate[dateStr] || [];
        return logs.reduce((sum, wl) => sum + wl.hours, 0);
    };

    const handleDragStart = (worklog: WorkLog, sourceDate: string) => (event: React.DragEvent<HTMLDivElement>) => {
        if (movingWorklogId !== null) {
            event.preventDefault();
            return;
        }

        setDraggedWorklog({ id: worklog.id, sourceDate });
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(worklog.id));
        event.dataTransfer.setData('application/x-worklog-date', sourceDate);
    };

    const handleDragOver = (targetDate: string) => (event: React.DragEvent<HTMLElement>) => {
        if (!draggedWorklog || draggedWorklog.sourceDate === targetDate || movingWorklogId !== null) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (dropTargetDate !== targetDate) {
            setDropTargetDate(targetDate);
        }
    };

    const handleDrop = (targetDate: string) => async (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();

        if (!draggedWorklog || draggedWorklog.sourceDate === targetDate || !onWorklogMove || movingWorklogId !== null) {
            setDropTargetDate(null);
            return;
        }

        const droppedId = Number(event.dataTransfer.getData('text/plain')) || draggedWorklog.id;
        const worklog = worklogs.find((item) => item.id === droppedId);

        setDropTargetDate(null);
        if (!worklog) {
            setDraggedWorklog(null);
            return;
        }

        await onWorklogMove(worklog, targetDate);
        setDraggedWorklog(null);
    };

    const handleDragEnd = () => {
        setDraggedWorklog(null);
        setDropTargetDate(null);
    };

    return (
        <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
                {t('calendar.dragHint')}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {/* Header row with day names */}
                {weekDates.map((date, idx) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const total = getDailyTotal(dateStr);
                    const isCurrentDay = isToday(date);
                    const isDropTarget = dropTargetDate === dateStr && draggedWorklog?.sourceDate !== dateStr;

                    return (
                        <Card
                            key={dateStr}
                            className={cn(
                                'min-h-[200px] flex flex-col transition-colors',
                                isDropTarget && 'ring-2 ring-emerald-500 bg-emerald-50/40',
                                !isDropTarget && isCurrentDay && 'ring-2 ring-primary'
                            )}
                            onDragOver={handleDragOver(dateStr)}
                            onDrop={handleDrop(dateStr)}
                        >
                            <CardHeader className="py-2 px-3">
                                <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="flex min-w-0 flex-col gap-1 text-sm">
                                        <span className={cn(isCurrentDay && 'text-primary font-bold')}>
                                            {DAYS[idx]}
                                        </span>
                                        <span className="text-xs font-normal text-muted-foreground">
                                            {format(date, 'MM/dd')}
                                        </span>
                                    </CardTitle>
                                    {onAIInputClick && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 w-7 shrink-0 rounded-full border-sky-200 bg-sky-50 p-0 text-sky-700 shadow-none hover:border-sky-300 hover:bg-sky-100 hover:text-sky-800"
                                            onClick={() => onAIInputClick(dateStr)}
                                            title={t('calendar.aiEntry')}
                                            aria-label={t('calendar.aiEntry')}
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-1 flex-col gap-2 p-2">
                                <div className="space-y-2">
                                    {/* Worklogs for this day */}
                                    {(worklogsByDate[dateStr] || []).map((wl) => (
                                        <div
                                            key={wl.id}
                                            draggable={movingWorklogId === null}
                                            aria-grabbed={draggedWorklog?.id === wl.id}
                                            className={`p-2 bg-white border border-slate-200 rounded-md text-xs hover:bg-slate-50 hover:border-slate-300 group relative shadow-sm ${
                                                draggedWorklog?.id === wl.id ? 'opacity-50 cursor-grabbing' : 'cursor-grab'
                                            } ${movingWorklogId === wl.id ? 'opacity-60 pointer-events-none' : ''}`}
                                            onClick={() => onWorklogEdit(wl)}
                                            onDragStart={handleDragStart(wl, dateStr)}
                                            onDragEnd={handleDragEnd}
                                            title={t('calendar.dragHint')}
                                        >
                                            <div className="flex justify-between items-start">
                                                <span className="font-medium truncate flex-1">
                                                    {wl.project_name || wl.project_code || '-'}
                                                </span>
                                                <span className="font-bold ml-1">{wl.hours}h</span>
                                            </div>
                                            <div className="text-muted-foreground truncate">
                                                {wl.work_type_category ? getLocalizedName(wl.work_type_category, i18n.language) : 'N/A'}
                                            </div>
                                            {wl.description && (
                                                <div className="text-muted-foreground/70 text-[11px] mt-1 line-clamp-2">
                                                    {wl.description}
                                                </div>
                                            )}
                                            <button
                                                className="hidden group-hover:block absolute top-1 right-1 text-destructive text-xs"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onWorklogDelete(wl.id);
                                                }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}

                                    {isDropTarget && (
                                        <div className="rounded-md border border-dashed border-emerald-400 bg-emerald-50 px-2 py-3 text-center text-xs font-medium text-emerald-700">
                                            {t('calendar.dropHere')}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-auto pt-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-full text-xs"
                                        onClick={() => onCellClick(dateStr)}
                                    >
                                        {t('calendar.addEntry')}
                                    </Button>
                                </div>
                            </CardContent>

                            {/* Daily total footer */}
                            <div className={`px-3 py-1 text-xs font-medium border-t ${total > 8 ? 'bg-yellow-100 text-yellow-800' :
                                total > 0 ? 'bg-green-50 text-green-700' :
                                    'bg-muted text-muted-foreground'
                                }`}>
                                {t('calendar.total')}: {total}h {total > 8 && '⚠️'}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default WeeklyCalendarGrid;
