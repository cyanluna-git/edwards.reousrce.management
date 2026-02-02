import React, { useState } from 'react';
import { ResourcePivotTable } from '@/components/resource-matrix/ResourcePivotTable';
import { WorklogDrilldownModal } from '@/components/resource-matrix/WorklogDrilldownModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const ResourceMatrixPage: React.FC = () => {
    // Default to current year
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const [selectedMonth, setSelectedMonth] = useState(
        `${currentYear}-${currentMonth.toString().padStart(2, '0')}`
    );

    const handleMonthChange = (delta: number) => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + delta, 1);
        const newYear = date.getFullYear();
        const newMonth = String(date.getMonth() + 1).padStart(2, '0');
        setSelectedMonth(`${newYear}-${newMonth}`);
    };

    const handleResetToday = () => {
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        setSelectedMonth(`${y}-${m}`);
    };

    // Drilldown State
    const [drilldownState, setDrilldownState] = useState<{
        isOpen: boolean;
        userId: string;
        userName: string;
        ioId: string;
        ioName: string;
    }>({
        isOpen: false,
        userId: '',
        userName: '',
        ioId: '',
        ioName: '',
    });

    const handleCellClick = (userId: string, userName: string, ioId: string, ioName: string) => {
        setDrilldownState({
            isOpen: true,
            userId,
            userName,
            ioId,
            ioName,
        });
    };

    return (
        <div className="h-full flex flex-col gap-2 p-2">
            {/* Header & Controls Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex-shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Resource Allocation Matrix
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5 ml-7">
                        Headcount Pivot Table (IO x User)
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Legend Integrated */}
                    <div className="hidden lg:flex items-center gap-3 mr-4 border-r pr-4 border-slate-200 h-8">
                        <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="px-1.5 py-0 h-5 text-[10px] bg-blue-100 text-blue-700 border-blue-200">INT</Badge>
                            <span className="text-xs text-slate-600">Internal</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="px-1.5 py-0 h-5 text-[10px] bg-green-100 text-green-700 border-green-200">RCH</Badge>
                            <span className="text-xs text-slate-600">Research</span>
                        </div>
                    </div>

                    {/* Month Navigation */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 w-10 p-0"
                            onClick={() => handleMonthChange(-1)}
                        >
                            <ChevronLeft className="h-4 w-4 text-slate-600" />
                        </Button>
                        <span className="text-sm font-medium text-slate-700 whitespace-nowrap min-w-[120px] text-center">
                            {selectedMonth}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 w-10 p-0"
                            onClick={() => handleMonthChange(1)}
                        >
                            <ChevronRight className="h-4 w-4 text-slate-600" />
                        </Button>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10 text-xs font-medium"
                        onClick={handleResetToday}
                    >
                        Today
                    </Button>
                </div>
            </div>

            {/* Info Strip (Mobile/Compact) */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1 flex-shrink-0">
                <div className="flex lg:hidden items-center gap-3">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> INT</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> RCH</span>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                    <Info className="w-3 h-3" />
                    Values are in FTE (1.0 = Regular Work Hours/Month)
                </div>
            </div>

            {/* Main Content Area - Full Height */}
            <Card className="flex-1 min-h-0 overflow-hidden border-slate-200 shadow-sm flex flex-col">
                <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
                    <div className="h-full overflow-auto">
                        <ResourcePivotTable
                            startMonth={selectedMonth}
                            endMonth={selectedMonth}
                            onCellClick={handleCellClick}
                        />
                    </div>
                </CardContent>
            </Card>

            <WorklogDrilldownModal
                isOpen={drilldownState.isOpen}
                onClose={() => setDrilldownState(prev => ({ ...prev, isOpen: false }))}
                userId={drilldownState.userId}
                userName={drilldownState.userName}
                month={selectedMonth}
                ioId={drilldownState.ioId}
                ioName={drilldownState.ioName}
            />
        </div>
    );
};

export default ResourceMatrixPage;
