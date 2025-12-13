/**
 * Milestone Timeline Component
 * Simple visual timeline for milestones in a scenario
 */
import { format, parseISO, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ScenarioMilestone } from '@/types';

interface MilestoneTimelineProps {
    milestones: ScenarioMilestone[];
    onMilestoneClick?: (milestone: ScenarioMilestone) => void;
    onAddMilestone?: () => void;
}

const STATUS_COLORS = {
    Pending: 'bg-yellow-100 border-yellow-500 text-yellow-700',
    Completed: 'bg-green-100 border-green-500 text-green-700',
    Delayed: 'bg-red-100 border-red-500 text-red-700',
};

const STATUS_DOT_COLORS = {
    Pending: 'bg-yellow-500',
    Completed: 'bg-green-500',
    Delayed: 'bg-red-500',
};

export function MilestoneTimeline({
    milestones,
    onMilestoneClick,
    onAddMilestone,
}: MilestoneTimelineProps) {
    const sortedMilestones = [...milestones].sort(
        (a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
    );

    const today = new Date();

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">마일스톤 타임라인</CardTitle>
                {onAddMilestone && (
                    <Button variant="outline" size="sm" onClick={onAddMilestone}>
                        + 추가
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {sortedMilestones.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        마일스톤이 없습니다.
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                        {/* Milestones */}
                        <div className="space-y-4">
                            {sortedMilestones.map((ms) => {
                                const targetDate = parseISO(ms.target_date);
                                const daysFromNow = differenceInDays(targetDate, today);
                                const status = ms.status as keyof typeof STATUS_COLORS;

                                return (
                                    <div
                                        key={ms.id}
                                        className="relative pl-10 cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => onMilestoneClick?.(ms)}
                                    >
                                        {/* Timeline dot */}
                                        <div className={`absolute left-2.5 w-4 h-4 rounded-full border-2 ${STATUS_DOT_COLORS[status] || 'bg-gray-500'
                                            }`} />

                                        {/* Milestone card */}
                                        <div className={`p-3 rounded-lg border-l-4 ${STATUS_COLORS[status] || 'bg-gray-100 border-gray-500'}`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-medium">{ms.name}</span>
                                                    {ms.is_key_gate && (
                                                        <span className="ml-2 text-xs bg-primary/10 text-primary px-1 rounded">
                                                            Key Gate
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs">
                                                    {ms.type === 'STD_GATE' ? '🚪' : '📌'}
                                                </span>
                                            </div>

                                            <div className="mt-1 text-sm">
                                                <span className="font-medium">
                                                    {format(targetDate, 'yyyy-MM-dd')}
                                                </span>
                                                {ms.actual_date && (
                                                    <span className="ml-2 text-muted-foreground">
                                                        (실적: {format(parseISO(ms.actual_date), 'yyyy-MM-dd')})
                                                    </span>
                                                )}
                                            </div>

                                            {/* Days indicator */}
                                            <div className="mt-1 text-xs">
                                                {daysFromNow > 0 && status === 'Pending' && (
                                                    <span className="text-blue-600">D-{daysFromNow}</span>
                                                )}
                                                {daysFromNow === 0 && (
                                                    <span className="text-orange-600 font-bold">Today!</span>
                                                )}
                                                {daysFromNow < 0 && status === 'Pending' && (
                                                    <span className="text-red-600 font-bold">
                                                        {Math.abs(daysFromNow)}일 지연
                                                    </span>
                                                )}
                                            </div>

                                            {ms.notes && (
                                                <p className="mt-1 text-xs text-muted-foreground truncate">
                                                    {ms.notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default MilestoneTimeline;
