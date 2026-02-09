import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { getCapacitySummary, getWorklogSummary, CapacitySummary, WorklogSummary } from '@/api/client';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c'];

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const ReportsPage: React.FC = () => {
    const { t } = useTranslation('reports');
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [activeTab, setActiveTab] = useState<'capacity' | 'worklog'>('capacity');

    // Fetch data
    const { data: capacityData, isLoading: capacityLoading } = useQuery<CapacitySummary>({
        queryKey: ['reports', 'capacity', selectedYear],
        queryFn: () => getCapacitySummary(selectedYear),
    });

    const { data: worklogData, isLoading: worklogLoading } = useQuery<WorklogSummary>({
        queryKey: ['reports', 'worklog', selectedYear],
        queryFn: () => getWorklogSummary(selectedYear),
    });

    const monthlyCapacity = capacityData?.monthly.map(m => ({
        name: MONTHS[m.month],
        month: m.month,
        FTE: m.total_fte,
        count: m.plan_count,
    })) || [];

    const monthlyWorklog = worklogData?.monthly.map(m => ({
        name: MONTHS[m.month],
        hours: m.total_hours,
        count: m.log_count,
    })) || [];

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <select
                    className="border rounded px-3 py-2"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                    {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                        <option key={y} value={y}>{t('yearSelector', { year: y })}</option>
                    ))}
                </select>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b">
                <button
                    className={`px-4 py-2 -mb-px ${activeTab === 'capacity'
                        ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                        : 'text-muted-foreground'
                        }`}
                    onClick={() => setActiveTab('capacity')}
                >
                    {t('tabs.capacity')}
                </button>
                <button
                    className={`px-4 py-2 -mb-px ${activeTab === 'worklog'
                        ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                        : 'text-muted-foreground'
                        }`}
                    onClick={() => setActiveTab('worklog')}
                >
                    {t('tabs.worklog')}
                </button>
            </div>

            {/* Capacity Tab */}
            {activeTab === 'capacity' && (
                <div className="space-y-6">
                    {capacityLoading ? (
                        <div className="text-center py-12">{t('status.loading')}</div>
                    ) : (
                        <>
                            {/* Monthly Bar Chart */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t('capacity.monthlyFte')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {monthlyCapacity.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            {t('capacity.noDataYear', { year: selectedYear })}
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={monthlyCapacity}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <Tooltip />
                                                <Bar dataKey="FTE" fill="#3b82f6" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            {/* By Position Pie & By Project Table */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>{t('capacity.byPosition')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {(capacityData?.by_position.length || 0) === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                {t('capacity.noData')}
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height={250}>
                                                <PieChart>
                                                    <Pie
                                                        data={capacityData?.by_position}
                                                        dataKey="total_fte"
                                                        nameKey="name"
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={80}
                                                        label={(entry) => entry.name}
                                                    >
                                                        {capacityData?.by_position.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>{t('capacity.byProjectTop10')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {(capacityData?.by_project.length || 0) === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                {t('capacity.noData')}
                                            </div>
                                        ) : (
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b">
                                                        <th className="text-left py-2">{t('capacity.project')}</th>
                                                        <th className="text-right py-2">{t('capacity.fte')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {capacityData?.by_project.map((p, i) => (
                                                        <tr key={i} className="border-b">
                                                            <td className="py-2">{p.code} - {p.name}</td>
                                                            <td className="text-right py-2">{p.total_fte.toFixed(1)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* WorkLog Tab */}
            {activeTab === 'worklog' && (
                <div className="space-y-6">
                    {worklogLoading ? (
                        <div className="text-center py-12">{t('status.loading')}</div>
                    ) : (
                        <>
                            {/* Monthly Bar Chart */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t('worklog.monthlyHours')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {monthlyWorklog.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            {t('worklog.noDataYear', { year: selectedYear })}
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={monthlyWorklog}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <Tooltip />
                                                <Bar dataKey="hours" fill="#10b981" name={t('chart.hours')} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            {/* By Type & By Project */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>{t('worklog.byType')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {(worklogData?.by_type.length || 0) === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                {t('worklog.noData')}
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height={250}>
                                                <PieChart>
                                                    <Pie
                                                        data={worklogData?.by_type}
                                                        dataKey="total_hours"
                                                        nameKey="type"
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={80}
                                                        label={({ name }: { name?: string }) => name || ''}
                                                    >
                                                        {worklogData?.by_type.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>{t('worklog.byProjectTop10')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {(worklogData?.by_project.length || 0) === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                {t('worklog.noData')}
                                            </div>
                                        ) : (
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b">
                                                        <th className="text-left py-2">{t('worklog.project')}</th>
                                                        <th className="text-right py-2">{t('worklog.hours')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {worklogData?.by_project.map((p, i) => (
                                                        <tr key={i} className="border-b">
                                                            <td className="py-2">{p.code} - {p.name}</td>
                                                            <td className="text-right py-2">{p.total_hours.toFixed(1)}h</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReportsPage;
