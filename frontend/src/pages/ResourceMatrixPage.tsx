/**
 * ResourceMatrixPage - Master Headcount Sheet Page
 * Shows resource allocation matrix with filters
 */
import React, { useState } from 'react';
import { ResourcePivotTable } from '@/components/resource-matrix/ResourcePivotTable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

export const ResourceMatrixPage: React.FC = () => {
    // Default to current year
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [startMonth, setStartMonth] = useState(
        `${currentYear}-${currentMonth.toString().padStart(2, '0')}`
    );
    const [endMonth, setEndMonth] = useState(
        `${currentYear}-12`
    );

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Resource Allocation Matrix</h1>
                <p className="text-slate-600 mt-2">
                    Headcount Pivot Table (IO x User)
                </p>
            </div>

            {/* Controls */}
            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-6 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-2 text-slate-700">
                                Start Month
                            </label>
                            <input
                                type="month"
                                value={startMonth}
                                onChange={(e) => setStartMonth(e.target.value)}
                                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-2 text-slate-700">
                                End Month
                            </label>
                            <input
                                type="month"
                                value={endMonth}
                                onChange={(e) => setEndMonth(e.target.value)}
                                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm text-slate-600">
                                <div className="font-medium mb-1">Period</div>
                                <div className="text-slate-500">
                                    {startMonth && endMonth ? (
                                        <>
                                            {startMonth} to {endMonth}
                                        </>
                                    ) : (
                                        'Select date range'
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Legend */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex gap-8 items-center text-sm">
                        <div className="flex items-center gap-2">
                            <div className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">INT</div>
                            <span className="text-slate-600">Internal IO</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-bold border border-green-200">RCH</div>
                            <span className="text-slate-600">Recharge IO</span>
                        </div>
                        <div className="ml-auto text-slate-500 italic">
                            Values are in FTE (1.0 = Regular Work Hours/Month)
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Matrix */}
            <Card>
                <CardHeader>
                    <CardTitle>Allocation Pivot</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResourcePivotTable
                        startMonth={startMonth}
                        endMonth={endMonth}
                    />
                </CardContent>
            </Card>
        </div>
    );
};

export default ResourceMatrixPage;
