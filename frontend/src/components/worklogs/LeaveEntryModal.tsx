/**
 * Leave Entry Modal Component
 * 휴가 등록 전용 모달 - 반휴/일휴/연속휴가 지원
 */
import React, { useState, useMemo } from 'react';
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
    defaultProjectId?: string; // Non-Project ID
    isLoading?: boolean;
}

export const LeaveEntryModal: React.FC<LeaveEntryModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    userId,
    defaultProjectId = '8a45fd77-809a-442c-8000-f82a0597964d', // General/Non-Project UUID
    isLoading = false,
}) => {
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
                project_id: defaultProjectId,
                work_type: 'Leave',
                hours: leaveType === 'half' ? 4 : 8,
                description: leaveType === 'half' ? '반휴' : '휴가',
                is_sudden_work: false,
                is_business_trip: false,
            });
        } else {
            // Consecutive leave - create one worklog per day
            for (const day of leaveDays) {
                worklogs.push({
                    date: format(day, 'yyyy-MM-dd'),
                    user_id: userId,
                    project_id: defaultProjectId,
                    work_type: 'Leave',
                    hours: 8,
                    description: '연속휴가',
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
                        🏖️ 휴가 등록
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Leave Type Selection */}
                    <div className="space-y-2">
                        <Label>휴가 유형</Label>
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
                                <div className="font-medium">반휴</div>
                                <div className="text-xs text-slate-500">4시간</div>
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
                                <div className="font-medium">일일휴가</div>
                                <div className="text-xs text-slate-500">8시간</div>
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
                                <div className="font-medium">연속휴가</div>
                                <div className="text-xs text-slate-500">기간 선택</div>
                            </button>
                        </div>
                    </div>

                    {/* Date Selection */}
                    {leaveType === 'consecutive' ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="startDate">시작일</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="endDate">종료일</Label>
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
                                <span className="text-sm">주말 제외</span>
                            </label>

                            {/* Preview */}
                            {leaveDays.length > 0 && (
                                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                                    <div className="font-medium text-blue-700">
                                        📅 {leaveDays.length}일 휴가 ({totalHours}시간)
                                    </div>
                                    <div className="text-blue-600 mt-1">
                                        {leaveDays.slice(0, 5).map(d => format(d, 'M/d(E)')).join(', ')}
                                        {leaveDays.length > 5 && ` 외 ${leaveDays.length - 5}일`}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <Label htmlFor="singleDate">날짜</Label>
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
                        <span className="text-sm text-slate-600">등록될 WorkLog</span>
                        <span className="font-bold text-lg">
                            {leaveType === 'consecutive' ? leaveDays.length : 1}건 / {totalHours}h
                        </span>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => { resetForm(); onClose(); }}>
                        취소
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || (leaveType === 'consecutive' && leaveDays.length === 0)}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isLoading ? '등록 중...' : '휴가 등록'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default LeaveEntryModal;
