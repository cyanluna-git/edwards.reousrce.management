/**
 * WorkLogs Page
 * Main page for managing work time entries
 */
import { useState } from 'react';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { WeeklyCalendarGrid } from '@/components/worklogs/WeeklyCalendarGrid';
import { WorkLogEntryModal } from '@/components/worklogs/WorkLogEntryModal';
import { LeaveEntryModal } from '@/components/worklogs/LeaveEntryModal';
import {
    useWorklogs,
    useCreateWorklog,
    useUpdateWorklog,
    useDeleteWorklog,
    useCopyWeek
} from '@/hooks/useWorklogs';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import type { WorkLog, WorkLogCreate, WorkLogUpdate } from '@/types';

export function WorkLogsPage() {
    const { user } = useAuth();
    const [weekStart, setWeekStart] = useState(() =>
        startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
    );
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [editingWorklog, setEditingWorklog] = useState<WorkLog | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

    // Calculate week range for API query
    const weekRange = {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(addWeeks(weekStart, 1), 'yyyy-MM-dd'),
    };

    // Fetch worklogs for the current week
    const { data: worklogs = [], isLoading, refetch } = useWorklogs({
        user_id: user?.id,
        start_date: weekRange.start,
        end_date: weekRange.end,
    });

    // Fetch projects for the modal
    const { data: projects = [] } = useProjects();

    // Mutations
    const createMutation = useCreateWorklog();
    const updateMutation = useUpdateWorklog();
    const deleteMutation = useDeleteWorklog();
    const copyWeekMutation = useCopyWeek();

    // Navigation handlers
    const goToPreviousWeek = () => setWeekStart((prev: Date) => subWeeks(prev, 1));
    const goToNextWeek = () => setWeekStart((prev: Date) => addWeeks(prev, 1));
    const goToToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

    // Modal handlers
    const handleCellClick = (date: string) => {
        setSelectedDate(date);
        setEditingWorklog(null);
        setIsModalOpen(true);
    };

    const handleWorklogEdit = (worklog: WorkLog) => {
        setEditingWorklog(worklog);
        setSelectedDate(worklog.date.split('T')[0]);
        setIsModalOpen(true);
    };

    const handleWorklogDelete = async (worklogId: number) => {
        if (confirm('Are you sure you want to delete this worklog?')) {
            await deleteMutation.mutateAsync(worklogId);
        }
    };

    const handleModalSubmit = async (data: WorkLogCreate | WorkLogUpdate) => {
        try {
            if (editingWorklog) {
                await updateMutation.mutateAsync({
                    id: editingWorklog.id,
                    data: data as WorkLogUpdate
                });
            } else {
                await createMutation.mutateAsync(data as WorkLogCreate);
            }
            setIsModalOpen(false);
            setEditingWorklog(null);
            setSelectedDate(null);
        } catch (error: any) {
            alert(error?.response?.data?.detail || 'An error occurred');
        }
    };

    const handleCopyWeek = async () => {
        if (!user?.id) return;

        if (confirm('Copy all worklogs from last week to this week?')) {
            try {
                await copyWeekMutation.mutateAsync({
                    user_id: user.id,
                    target_week_start: format(weekStart, 'yyyy-MM-dd'),
                });
                refetch();
            } catch (error: any) {
                alert(error?.response?.data?.detail || 'Failed to copy week');
            }
        }
    };

    // Leave submit handler
    const handleLeaveSubmit = async (worklogs: WorkLogCreate[]) => {
        try {
            for (const worklog of worklogs) {
                await createMutation.mutateAsync(worklog);
            }
            setIsLeaveModalOpen(false);
            refetch();
        } catch (error: any) {
            alert(error?.response?.data?.detail || 'Failed to register leave');
        }
    };

    // Calculate week total
    const weekTotal = worklogs.reduce((sum, wl) => sum + wl.hours, 0);

    return (
        <div className="container mx-auto p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">WorkLogs</h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsLeaveModalOpen(true)}>
                        🏖️ 휴가 등록
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCopyWeek}>
                        📋 Copy Last Week
                    </Button>
                </div>
            </div>

            {/* Week Navigation */}
            <Card>
                <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setWeekStart(subWeeks(weekStart, 4))}>
                                ⏪
                            </Button>
                            <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                                ◀
                            </Button>
                            <Button variant="outline" size="sm" onClick={goToToday}>
                                Today
                            </Button>
                            <Button variant="outline" size="sm" onClick={goToNextWeek}>
                                ▶
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 4))}>
                                ⏩
                            </Button>
                        </div>

                        <CardTitle className="text-lg">
                            {format(weekStart, 'yyyy-MM-dd')} ~ {format(addWeeks(weekStart, 1), 'yyyy-MM-dd')}
                        </CardTitle>

                        <div className="text-right">
                            <span className="text-sm text-muted-foreground">Week Total: </span>
                            <span className={`font-bold ${weekTotal > 40 ? 'text-yellow-600' : 'text-green-600'}`}>
                                {weekTotal}h
                            </span>
                            <span className="text-sm text-muted-foreground"> / 40h</span>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Calendar Grid */}
            {isLoading ? (
                <div className="text-center py-8">Loading worklogs...</div>
            ) : (
                <WeeklyCalendarGrid
                    weekStart={weekStart}
                    worklogs={worklogs}
                    onCellClick={handleCellClick}
                    onWorklogEdit={handleWorklogEdit}
                    onWorklogDelete={handleWorklogDelete}
                />
            )}

            {/* Entry Modal */}
            <WorkLogEntryModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingWorklog(null);
                    setSelectedDate(null);
                }}
                onSubmit={handleModalSubmit}
                date={selectedDate || ''}
                userId={user?.id || ''}
                projects={projects}
                initialData={editingWorklog ? {
                    project_id: editingWorklog.project_id,
                    work_type: editingWorklog.work_type,
                    hours: editingWorklog.hours,
                    description: editingWorklog.description || '',
                    meeting_type: editingWorklog.meeting_type || '',
                    is_sudden_work: editingWorklog.is_sudden_work,
                    is_business_trip: editingWorklog.is_business_trip,
                } : undefined}
                isEditing={!!editingWorklog}
                isLoading={createMutation.isPending || updateMutation.isPending}
            />

            {/* Leave Entry Modal */}
            <LeaveEntryModal
                isOpen={isLeaveModalOpen}
                onClose={() => setIsLeaveModalOpen(false)}
                onSubmit={handleLeaveSubmit}
                userId={user?.id || ''}
                defaultProjectId="8a45fd77-809a-442c-8000-f82a0597964d"
                isLoading={createMutation.isPending}
            />
        </div>
    );
}

export default WorkLogsPage;
