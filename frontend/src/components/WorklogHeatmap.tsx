import React from 'react';
import { format, subDays, eachDayOfInterval, startOfWeek, getDay } from 'date-fns';
import { WorklogStats } from '@/types';

interface WorklogHeatmapProps {
    data: WorklogStats[];
    days?: number; // Default 365
}

export const WorklogHeatmap: React.FC<WorklogHeatmapProps> = ({ data, days = 365 }) => {
    const today = new Date();
    const startDate = subDays(today, days);

    // Align start date to the previous Sunday (or Monday, depending on locale preference, use Sunday for now)
    // to ensure the grid starts correctly aligned
    const gridStartDate = startOfWeek(startDate);

    // Generate all days to display
    const allDays = eachDayOfInterval({
        start: gridStartDate,
        end: today,
    });

    // Create a map for quick lookup
    const statsMap = new Map<string, WorklogStats>();
    data.forEach(stat => {
        statsMap.set(stat.date, stat);
    });

    // Calculate intensity levels
    const getIntensityClass = (value: number) => {
        if (value === 0) return 'bg-slate-100 dark:bg-slate-800';
        if (value <= 2) return 'bg-green-200 dark:bg-green-900/40';
        if (value <= 4) return 'bg-green-300 dark:bg-green-800/60';
        if (value <= 8) return 'bg-green-400 dark:bg-green-700/80';
        return 'bg-green-500 dark:bg-green-600';
    };

    // Group days by week (Sunday to Saturday)
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    allDays.forEach((day) => {
        if (getDay(day) === 0 && currentWeek.length > 0) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
        currentWeek.push(day);
    });
    if (currentWeek.length > 0) {
        weeks.push(currentWeek);
    }

    // Month labels
    const monthLabels: { label: string; index: number }[] = [];
    let currentMonth = -1;

    weeks.forEach((week, index) => {
        const firstDay = week[0];
        const month = firstDay.getMonth();
        if (month !== currentMonth) {
            monthLabels.push({
                label: format(firstDay, 'MMM'),
                index: index,
            });
            currentMonth = month;
        }
    });

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-fit">
                {/* Month labels */}
                <div className="flex text-xs text-muted-foreground mb-1 ml-8 relative h-4">
                    {monthLabels.map((label, i) => (
                        <div
                            key={i}
                            style={{
                                position: 'absolute',
                                left: `${label.index * 14}px` // 14px is approx grid gap + size
                            }}
                        >
                            {label.label}
                        </div>
                    ))}
                </div>

                <div className="flex gap-1">
                    {/* Day labels (Mon, Wed, Fri) */}
                    <div className="flex flex-col gap-1 text-[10px] text-muted-foreground pt-0 mr-1 mt-[2px]">
                        <div className="h-2.5"></div>
                        <div className="h-2.5 flex items-center">Mon</div>
                        <div className="h-2.5"></div>
                        <div className="h-2.5 flex items-center">Wed</div>
                        <div className="h-2.5"></div>
                        <div className="h-2.5 flex items-center">Fri</div>
                        <div className="h-2.5"></div>
                    </div>

                    {/* The Grid */}
                    <div className="flex gap-1">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="flex flex-col gap-1">
                                {week.map((day) => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const stat = statsMap.get(dateStr);
                                    const hours = stat ? stat.total_hours : 0;
                                    const count = stat ? stat.count : 0;

                                    return (
                                        <div
                                            key={dateStr}
                                            className={`w-2.5 h-2.5 rounded-sm ${getIntensityClass(hours)} transition-colors cursor-help`}
                                            title={`${dateStr}: ${hours} hours (${count} entries)`}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
                    <span>Less</span>
                    <div className="flex gap-1">
                        <div className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-slate-800"></div>
                        <div className="w-2.5 h-2.5 rounded-sm bg-green-200 dark:bg-green-900/40"></div>
                        <div className="w-2.5 h-2.5 rounded-sm bg-green-300 dark:bg-green-800/60"></div>
                        <div className="w-2.5 h-2.5 rounded-sm bg-green-400 dark:bg-green-700/80"></div>
                        <div className="w-2.5 h-2.5 rounded-sm bg-green-500 dark:bg-green-600"></div>
                    </div>
                    <span>More</span>
                </div>
            </div>
        </div>
    );
};
