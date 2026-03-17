import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMilestones } from '@/api/client';
import type { ProjectMilestone } from '@/types';

interface MilestoneRowProps {
    projectId: string;
    months: { year: number; month: number; label: string }[];
}

function getMilestoneStatusClass(status: ProjectMilestone['status']): string {
    switch (status) {
        case 'Completed':
            return 'text-green-600';
        case 'Delayed':
            return 'text-red-600';
        default:
            return 'text-slate-400';
    }
}

function getMilestoneIcon(isKeyGate: boolean): string {
    return isKeyGate ? '🏁' : '◆';
}

/**
 * MilestoneRow - Renders a milestone overlay row in the resource plan table header.
 * Shows milestones grouped by their target_date month, aligned with the month columns.
 * Returns null if the project has no milestones.
 */
export const MilestoneRow: React.FC<MilestoneRowProps> = ({ projectId, months }) => {
    const { t } = useTranslation('resource-plans');

    const { data: milestones = [] } = useQuery<ProjectMilestone[]>({
        queryKey: ['milestones', projectId],
        queryFn: () => getMilestones(projectId),
        staleTime: 1000 * 60 * 5,
    });

    if (milestones.length === 0) {
        return null;
    }

    // Group milestones by YYYY-M key (matching month key format year-month without zero padding)
    const milestonesByMonth: Record<string, ProjectMilestone[]> = {};
    milestones.forEach(ms => {
        if (!ms.target_date) return;
        const date = new Date(ms.target_date);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        if (!milestonesByMonth[key]) {
            milestonesByMonth[key] = [];
        }
        milestonesByMonth[key].push(ms);
    });

    return (
        <tr className="bg-slate-50 border-b">
            <th className="text-left py-1 px-2 sticky left-0 bg-slate-50 min-w-[160px] z-30 text-xs font-medium text-slate-500 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                {t('resourceTable.milestones')}
            </th>
            {months.map(m => {
                const monthKey = `${m.year}-${m.month}`;
                const monthMilestones = milestonesByMonth[monthKey] || [];

                return (
                    <td key={monthKey} className="text-center py-1 px-1 border-l min-w-[50px]">
                        {monthMilestones.length > 0 && (
                            <div className="flex flex-col items-center gap-0.5">
                                {monthMilestones.map(ms => {
                                    const statusClass = getMilestoneStatusClass(ms.status);
                                    const icon = getMilestoneIcon(ms.is_key_gate);
                                    const tooltipText = [
                                        ms.name,
                                        ms.target_date,
                                        ms.status,
                                        ms.description,
                                    ]
                                        .filter(Boolean)
                                        .join(' | ');

                                    return (
                                        <span
                                            key={ms.id}
                                            title={tooltipText}
                                            className={[
                                                'text-xs leading-tight cursor-default select-none',
                                                statusClass,
                                                ms.is_key_gate ? 'font-bold' : 'font-normal',
                                            ].join(' ')}
                                        >
                                            {icon} {ms.name}
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </td>
                );
            })}
            {/* Action column spacer */}
            <td className="min-w-[80px]" />
        </tr>
    );
};
