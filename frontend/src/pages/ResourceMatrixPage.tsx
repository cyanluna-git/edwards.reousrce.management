/**
 * ResourceMatrixPage - Master Headcount Sheet Page
 * Shows resource allocation matrix with filters
 */
import React, { useState } from 'react';
import { ResourceAllocationGrid } from '@/components/resource-matrix/ResourceAllocationGrid';
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
                    Master headcount sheet showing resource allocations by program, project, and month
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
                            <div className="w-4 h-4 bg-blue-100 border border-slate-300 rounded"></div>
                            <span className="text-slate-600">Program Total</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-white border border-slate-300 rounded"></div>
                            <span className="text-slate-600">Project Allocation</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-blue-200 border border-slate-300 rounded"></div>
                            <span className="text-slate-600">Grand Total</span>
                        </div>
                        <div className="ml-auto text-slate-500 italic">
                            Click on any allocation cell to view individual resource details
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Matrix */}
            <Card>
                <CardHeader>
                    <CardTitle>Allocation Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResourceAllocationGrid
                        startMonth={startMonth}
                        endMonth={endMonth}
                    />
                </CardContent>
            </Card>
        </div>
    );
};

export default ResourceMatrixPage;
