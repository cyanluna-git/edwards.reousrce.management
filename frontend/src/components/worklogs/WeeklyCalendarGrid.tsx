/**
 * Weekly Calendar Grid Component
 * Displays worklogs in a 7-day grid format
 */
import React from 'react';
import { format, addDays, isToday } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { WorkLog } from '@/types';

interface WeeklyCalendarGridProps {
    weekStart: Date;
    worklogs: WorkLog[];
    onCellClick: (date: string) => void;
    onWorklogEdit: (worklog: WorkLog) => void;
    onWorklogDelete: (worklogId: number) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const WeeklyCalendarGrid: React.FC<WeeklyCalendarGridProps> = ({
    weekStart,
    worklogs,
    onCellClick,
    onWorklogEdit,
    onWorklogDelete,
}) => {
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

    return (
        <div className="grid grid-cols-7 gap-2">
            {/* Header row with day names */}
            {weekDates.map((date, idx) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const total = getDailyTotal(dateStr);
                const isCurrentDay = isToday(date);

                return (
                    <Card
                        key={dateStr}
                        className={`min-h-[200px] ${isCurrentDay ? 'ring-2 ring-primary' : ''}`}
                    >
                        <CardHeader className="py-2 px-3">
                            <CardTitle className="text-sm flex justify-between items-center">
                                <span className={isCurrentDay ? 'text-primary font-bold' : ''}>
                                    {DAYS[idx]}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {format(date, 'MM/dd')}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-2 space-y-1">
                            {/* Worklogs for this day */}
                            {(worklogsByDate[dateStr] || []).map((wl) => (
                                <div
                                    key={wl.id}
                                    className="p-2 bg-muted rounded text-xs cursor-pointer hover:bg-muted/80 group"
                                    onClick={() => onWorklogEdit(wl)}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="font-medium truncate flex-1">
                                            {wl.project_name || wl.project_code || '-'}
                                        </span>
                                        <span className="font-bold ml-1">{wl.hours}h</span>
                                    </div>
                                    <div className="text-muted-foreground truncate">
                                        {wl.work_type_category?.name || 'N/A'}
                                    </div>
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

                            {/* Add button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs h-7 mt-1"
                                onClick={() => onCellClick(dateStr)}
                            >
                                + Add
                            </Button>
                        </CardContent>

                        {/* Daily total footer */}
                        <div className={`px-3 py-1 text-xs font-medium border-t ${total > 8 ? 'bg-yellow-100 text-yellow-800' :
                            total > 0 ? 'bg-green-50 text-green-700' :
                                'bg-muted text-muted-foreground'
                            }`}>
                            Total: {total}h {total > 8 && '⚠️'}
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};

export default WeeklyCalendarGrid;
