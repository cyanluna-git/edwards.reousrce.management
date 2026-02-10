/**
 * Leave Entry Modal Component
 * 휴가 등록 전용 모달 - 반휴/일휴/연속휴가 지원
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { eachDayOfInterval, isWeekend, format } from 'date-fns';
import type { WorkLogCreate } from '@/types';

type LeaveType = 'half' | 'full' | 'consecutive';

interface LeaveEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (worklogs: WorkLogCreate[]) => void;
    userId: string;
    isLoading?: boolean;
}

export const LeaveEntryModal: React.FC<LeaveEntryModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    userId,
    isLoading = false,
}) => {
    const { t } = useTranslation('worklogs');
    const [leaveType, setLeaveType] = useState<LeaveType>('full');
    const [singleDate, setSingleDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [excludeWeekends, setExcludeWeekends] = useState<boolean>(true);

    // Calculate consecutive leave days
    const leaveDays = useMemo(() => {
        if (leaveType !== 'consecutive') return [];

        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (start > end) return [];

            const allDays = eachDayOfInterval({ start, end });
            return excludeWeekends
                ? allDays.filter(day => !isWeekend(day))
                : allDays;
        } catch {
            return [];
        }
    }, [leaveType, startDate, endDate, excludeWeekends]);

    const totalHours = useMemo(() => {
        if (leaveType === 'half') return 4;
        if (leaveType === 'full') return 8;
        return leaveDays.length * 8;
    }, [leaveType, leaveDays]);

    const handleSubmit = () => {
        const worklogs: WorkLogCreate[] = [];

        if (leaveType === 'half' || leaveType === 'full') {
            worklogs.push({
                date: singleDate,
                user_id: userId,
                // project_id: defaultProjectId, // Removed: Leave entries should not have a project
                work_type_category_id: 38, // ABS-LVE (휴가)
                hours: leaveType === 'half' ? 4 : 8,
                description: leaveType === 'half' ? t('leave.halfDay') : t('leave.fullDay'),
                is_sudden_work: false,
                is_business_trip: false,
            });
        } else {
            // Consecutive leave - create one worklog per day
            for (const day of leaveDays) {
                worklogs.push({
                    date: format(day, 'yyyy-MM-dd'),
                    user_id: userId,
                    // project_id: defaultProjectId, // Removed: Leave entries should not have a project
                    work_type_category_id: 38, // ABS-LVE (휴가)
                    hours: 8,
                    description: t('leave.consecutive'),
                    is_sudden_work: false,
                    is_business_trip: false,
                });
            }
        }

        onSubmit(worklogs);
    };

    const resetForm = () => {
        setLeaveType('full');
        setSingleDate(format(new Date(), 'yyyy-MM-dd'));
        setStartDate(format(new Date(), 'yyyy-MM-dd'));
        setEndDate(format(new Date(), 'yyyy-MM-dd'));
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetForm(); onClose(); } }}>
            <DialogContent className="sm:max-w-[450px] bg-white border shadow-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {t('leave.title')}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Leave Type Selection */}
                    <div className="space-y-2">
                        <Label>{t('leave.leaveType')}</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setLeaveType('half')}
                                className={`p-3 rounded-lg border-2 text-center transition-all ${leaveType === 'half'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className="text-2xl mb-1">🌓</div>
                                <div className="font-medium">{t('leave.halfDay')}</div>
                                <div className="text-xs text-slate-500">{t('leave.nHours', { count: 4 })}</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLeaveType('full')}
                                className={`p-3 rounded-lg border-2 text-center transition-all ${leaveType === 'full'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className="text-2xl mb-1">🌅</div>
                                <div className="font-medium">{t('leave.fullDay')}</div>
                                <div className="text-xs text-slate-500">{t('leave.nHours', { count: 8 })}</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLeaveType('consecutive')}
                                className={`p-3 rounded-lg border-2 text-center transition-all ${leaveType === 'consecutive'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className="text-2xl mb-1">🏝️</div>
                                <div className="font-medium">{t('leave.consecutive')}</div>
                                <div className="text-xs text-slate-500">{t('leave.selectPeriod')}</div>
                            </button>
                        </div>
                    </div>

                    {/* Date Selection */}
                    {leaveType === 'consecutive' ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="startDate">{t('leave.startDate')}</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="endDate">{t('leave.endDate')}</Label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Weekend exclusion toggle */}
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={excludeWeekends}
                                    onChange={(e) => setExcludeWeekends(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm">{t('leave.excludeWeekends')}</span>
                            </label>

                            {/* Preview */}
                            {leaveDays.length > 0 && (
                                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                                    <div className="font-medium text-blue-700">
                                        {t('leave.leaveSummary', { days: leaveDays.length, hours: totalHours })}
                                    </div>
                                    <div className="text-blue-600 mt-1">
                                        {leaveDays.slice(0, 5).map(d => format(d, 'M/d(E)')).join(', ')}
                                        {leaveDays.length > 5 && ` ${t('leave.andMoreDays', { count: leaveDays.length - 5 })}`}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <Label htmlFor="singleDate">{t('leave.date')}</Label>
                            <Input
                                id="singleDate"
                                type="date"
                                value={singleDate}
                                onChange={(e) => setSingleDate(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Summary */}
                    <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                        <span className="text-sm text-slate-600">{t('leave.worklogsToRegister')}</span>
                        <span className="font-bold text-lg">
                            {t('leave.entrySummary', { count: leaveType === 'consecutive' ? leaveDays.length : 1, hours: totalHours })}
                        </span>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => { resetForm(); onClose(); }}>
                        {t('leave.cancel')}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || (leaveType === 'consecutive' && leaveDays.length === 0)}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isLoading ? t('leave.submitting') : t('leave.submit')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default LeaveEntryModal;
