import React, { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useDashboard } from '@/hooks/useDashboard';
import type { TeamDashboardScope, DashboardViewMode } from '@/api/client';
import { useWorklogsTable } from '@/hooks/useWorklogs';
import { useWorkTypeCategories } from '@/hooks/useWorkTypeCategories';
import { Card, CardContent, CardHeader, CardTitle, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { Construction } from 'lucide-react';
import { L1_CATEGORY_COLORS, L2_COLORS } from '@/lib/constants';
import { TeamDashboardContent } from '@/components/dashboard/TeamDashboardContent';

type ViewMode = 'weekly' | 'monthly' | 'quarterly' | 'halfYear' | 'yearly';

// TeamDashboardContent component extracted to @/components/dashboard/TeamDashboardContent.tsx

export const DashboardPage: React.FC = () => {
    const { data, isLoading, error } = useDashboard();
    const { user } = useAuth();
    const { data: categoryTree = [] } = useWorkTypeCategories();
    const [viewMode, setViewMode] = useState<ViewMode>('weekly');
    const [drillDownPath, setDrillDownPath] = useState<string[]>([]); // Stack of codes: ['ENG', 'ENG-SW']

    // Team Dashboard state
    const [teamViewMode, setTeamViewMode] = useState<DashboardViewMode>('weekly');
    const [teamScope, setTeamScope] = useState<TeamDashboardScope>('department');

    // ... (Date calculations) ...
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const quarterStart = format(startOfQuarter(now), 'yyyy-MM-dd');
    const quarterEnd = format(endOfQuarter(now), 'yyyy-MM-dd');
    const halfYearStart = format(subMonths(startOfMonth(now), 5), 'yyyy-MM-dd'); // last 6 months
    const halfYearEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const yearStart = format(startOfYear(now), 'yyyy-MM-dd');
    const yearEnd = format(endOfYear(now), 'yyyy-MM-dd');

    const { data: weeklyWorklogs = [] } = useWorklogsTable({
        start_date: weekStart,
        end_date: weekEnd,
        user_id: user?.id,
        limit: 100,
        enabled: viewMode === 'weekly',
    });

    const { data: monthlyWorklogs = [] } = useWorklogsTable({
        start_date: monthStart,
        end_date: monthEnd,
        user_id: user?.id,
        limit: 200,
        enabled: viewMode === 'monthly',
    });

    const { data: quarterlyWorklogs = [] } = useWorklogsTable({
        start_date: quarterStart,
        end_date: quarterEnd,
        user_id: user?.id,
        limit: 500,
        enabled: viewMode === 'quarterly',
    });

    const { data: halfYearWorklogs = [] } = useWorklogsTable({
        start_date: halfYearStart,
        end_date: halfYearEnd,
        user_id: user?.id,
        limit: 1000,
        enabled: viewMode === 'halfYear',
    });

    const { data: yearlyWorklogs = [] } = useWorklogsTable({
        start_date: yearStart,
        end_date: yearEnd,
        user_id: user?.id,
        limit: 2000,
        enabled: viewMode === 'yearly',
    });

    const currentWorklogs = useMemo(() => {
        switch (viewMode) {
            case 'weekly': return weeklyWorklogs;
            case 'monthly': return monthlyWorklogs;
            case 'quarterly': return quarterlyWorklogs;
            case 'halfYear': return halfYearWorklogs;
            case 'yearly': return yearlyWorklogs;
            default: return weeklyWorklogs;
        }
    }, [viewMode, weeklyWorklogs, monthlyWorklogs, quarterlyWorklogs, halfYearWorklogs, yearlyWorklogs]);
    const totalHours = currentWorklogs.reduce((sum, wl) => sum + wl.hours, 0);

    // Group by project
    const projectSummary = currentWorklogs.reduce((acc, wl) => {
        const key = wl.project_id || 'non-project';
        if (!acc[key]) {
            acc[key] = { project_id: wl.project_id || 'non-project', project_code: wl.project_code || '', project_name: wl.project_name || '', hours: 0 };
        }
        acc[key].hours += wl.hours;
        return acc;
    }, {} as Record<string, { project_id: string; project_code: string; project_name: string; hours: number }>);
    const allProjects = Object.values(projectSummary).sort((a, b) => b.hours - a.hours);

    // Top 5 projects + Others
    const TOP_N = 5;
    const topProjects = allProjects.slice(0, TOP_N);
    const otherProjects = allProjects.slice(TOP_N);
    const otherHours = otherProjects.reduce((sum, p) => sum + p.hours, 0);
    const projectList = otherHours > 0
        ? [...topProjects, { project_id: 'others', project_code: '기타', project_name: `${otherProjects.length}개 프로젝트`, hours: otherHours }]
        : topProjects;

    // Build Category Map for easy lookup [Code -> Category Object]
    const categoryMap = useMemo(() => {
        const map: Record<string, any> = {};
        const traverse = (cats: any[], parent?: any) => {
            for (const cat of cats) {
                map[cat.code] = { ...cat, parent };
                if (cat.children) traverse(cat.children, cat);
            }
        };
        traverse(categoryTree);
        return map;
    }, [categoryTree]);

    // Calculate Project vs Functional Ratio
    const projectVsFunctionalData = useMemo(() => {
        // Debug: Log first worklog's project info
        if (currentWorklogs.length > 0) {
            console.log('Sample Worklog Project:', currentWorklogs[0].project);
        }

        const counts = currentWorklogs.reduce((acc, wl) => {
            const category = wl.project?.category || 'PROJECT';
            const key = category === 'FUNCTIONAL' ? 'Functional Activity' : 'Project';
            acc[key] = (acc[key] || 0) + wl.hours;
            return acc;
        }, {} as Record<string, number>);

        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return Object.entries(counts).map(([name, value]) => ({
            name,
            value,
            percentage: total > 0 ? ((value / total) * 100).toFixed(0) : '0',
            color: name === 'Project' ? '#3b82f6' : '#cbd5e1' // Blue vs Slate-300
        })).sort((a, b) => b.value - a.value);
    }, [currentWorklogs]);

    // Build Category ID Map [ID -> Code]
    const categoryIdToCode = useMemo(() => {
        const map: Record<number, string> = {};
        const traverse = (cats: any[]) => {
            for (const cat of cats) {
                map[cat.id] = cat.code;
                if (cat.children) traverse(cat.children);
            }
        };
        traverse(categoryTree);
        return map;
    }, [categoryTree]);


    // Determine Chart Data based on Drill Down Level
    // Level 0: L1 Distribution
    // Level 1: L2 Distribution (filtered by L1)
    // Level 2: L3 Distribution (filtered by L2)
    const activeChartData = useMemo(() => {
        const currentLevel = drillDownPath.length; // 0, 1, or 2
        const parentCode = currentLevel > 0 ? drillDownPath[currentLevel - 1] : null;

        // Bucket accumulator
        const buckets: Record<string, { name: string; code: string; value: number; color?: string }> = {};

        currentWorklogs.forEach(wl => {
            // Determine WL's path
            let l1 = 'Other';
            let l2 = 'Other';
            let l3 = 'Other';
            let l1Name = '기타';
            let l2Name = '기타';
            let l3Name = '기타';

            // Try to resolve from ID first (New Logic)
            if (wl.work_type_category_id && categoryIdToCode[wl.work_type_category_id]) {
                const code = categoryIdToCode[wl.work_type_category_id];
                const cat = categoryMap[code];

                if (cat.level === 3) {
                    l3 = cat.code; l3Name = cat.name_ko || cat.name;
                    l2 = cat.parent?.code; l2Name = cat.parent?.name_ko || cat.parent?.name;
                    l1 = cat.parent?.parent?.code; l1Name = cat.parent?.parent?.name_ko || cat.parent?.parent?.name;
                } else if (cat.level === 2) {
                    l2 = cat.code; l2Name = cat.name_ko || cat.name;
                    l1 = cat.parent?.code; l1Name = cat.parent?.name_ko || cat.parent?.name;
                } else if (cat.level === 1) {
                    l1 = cat.code; l1Name = cat.name_ko || cat.name;
                }
            } else {
                // No valid work_type_category_id - use default
                l1 = 'ADM'; // Default
                l1Name = '행정';
            }

            // Filtering Logic
            let targetGroupKey: string | null = null;
            let targetGroupName = '';

            if (currentLevel === 0) {
                targetGroupKey = l1;
                targetGroupName = l1Name;
            } else if (currentLevel === 1) {
                // Showing L2s for specific L1
                if (l1 === parentCode) {
                    targetGroupKey = l2;
                    targetGroupName = l2Name;
                }
            } else if (currentLevel === 2) {
                // Showing L3s for specific L2
                if (l2 === parentCode) {
                    targetGroupKey = l3;
                    targetGroupName = l3Name;
                }
            }

            if (targetGroupKey) {
                if (!buckets[targetGroupKey]) {
                    buckets[targetGroupKey] = { name: targetGroupName, code: targetGroupKey, value: 0 };
                }
                buckets[targetGroupKey].value += wl.hours;
            }
        });

        const totalFilteredHours = Object.values(buckets).reduce((sum, b) => sum + b.value, 0);

        return Object.values(buckets)
            .sort((a, b) => b.value - a.value)
            .map(item => {
                let color = '#64748b';
                // Color Logic
                if (currentLevel === 0) {
                    color = L1_CATEGORY_COLORS[item.code]?.color || '#94a3b8';
                } else if (currentLevel === 1) {
                    // Try L2 Colors map first
                    color = L2_COLORS[parentCode || '']?.[item.name] || L2_COLORS[parentCode || '']?.[item.code] || '#94a3b8';
                    // If fail, fallback to L1 color but faded? Or generate palette.
                    if (color === '#94a3b8' && parentCode) {
                        color = L1_CATEGORY_COLORS[parentCode]?.color; // Fallback
                    }
                } else {
                    // L3 Colors - Derived from L2 or random
                    // Simple logic: use parent color
                    color = '#94a3b8';
                }

                return {
                    ...item,
                    color,
                    percentage: totalFilteredHours > 0 ? ((item.value / totalFilteredHours) * 100).toFixed(0) : '0',
                };
            });

    }, [drillDownPath, currentWorklogs, categoryMap, categoryIdToCode]);

    const activeLabel = useMemo(() => {
        if (drillDownPath.length === 0) return null;
        const lastCode = drillDownPath[drillDownPath.length - 1];
        const cat = categoryMap[lastCode];
        return cat ? (cat.name_ko || cat.name) : lastCode;
    }, [drillDownPath, categoryMap]);

    // Breadcrumb handler
    const handleDrillUp = () => {
        setDrillDownPath(prev => prev.slice(0, -1));
    };

    if (isLoading) {
        return <div className="container mx-auto p-4"><div className="text-center py-12">로딩 중...</div></div>;
    }

    if (error || !data) {
        return <div className="container mx-auto p-4"><div className="text-center py-12 text-red-500">대시보드를 불러오는데 실패했습니다.</div></div>;
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* View Mode Tabs */}
            <Tabs defaultValue="user" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="user">User Dashboard</TabsTrigger>
                    <TabsTrigger value="team">Team Dashboard</TabsTrigger>
                    <TabsTrigger value="project">Project Dashboard</TabsTrigger>
                </TabsList>

                <TabsContent value="user" className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                        <Button variant={viewMode === 'weekly' ? 'default' : 'outline'} onClick={() => setViewMode('weekly')} size="sm">
                            📅 이번 주
                        </Button>
                        <Button variant={viewMode === 'monthly' ? 'default' : 'outline'} onClick={() => setViewMode('monthly')} size="sm">
                            📆 이번 달
                        </Button>
                        <Button variant={viewMode === 'quarterly' ? 'default' : 'outline'} onClick={() => setViewMode('quarterly')} size="sm">
                            📊 이번 분기
                        </Button>
                        <Button variant={viewMode === 'halfYear' ? 'default' : 'outline'} onClick={() => setViewMode('halfYear')} size="sm">
                            📈 최근 6개월
                        </Button>
                        <Button variant={viewMode === 'yearly' ? 'default' : 'outline'} onClick={() => setViewMode('yearly')} size="sm">
                            🗓️ 올해
                        </Button>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {viewMode === 'weekly' && '이번 주 WorkLog'}
                                    {viewMode === 'monthly' && '이번 달 WorkLog'}
                                    {viewMode === 'quarterly' && '이번 분기 WorkLog'}
                                    {viewMode === 'halfYear' && '최근 6개월 WorkLog'}
                                    {viewMode === 'yearly' && '올해 WorkLog'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{totalHours.toFixed(0)}h</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {viewMode === 'weekly' && `${weekStart} ~ ${weekEnd}`}
                                    {viewMode === 'monthly' && `${monthStart} ~ ${monthEnd}`}
                                    {viewMode === 'quarterly' && `${quarterStart} ~ ${quarterEnd}`}
                                    {viewMode === 'halfYear' && `${halfYearStart} ~ ${halfYearEnd}`}
                                    {viewMode === 'yearly' && `${yearStart} ~ ${yearEnd}`}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">참여 프로젝트</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{projectList.length}개</div>
                                <p className="text-xs text-muted-foreground mt-1">{viewMode === 'weekly' ? '이번 주' : '이번 달'}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">이번 달 배정량</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{data.resource_allocation.total_fte} FTE</div>
                                <p className="text-xs text-muted-foreground mt-1">계획된 리소스</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Left Column: Project vs Functional & Project List */}
                        <div className="space-y-4 lg:col-span-1">
                            {/* Project vs Functional Ratio (Horizontal Bar) */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>{viewMode === 'weekly' ? '주간' : '월간'} Project vs Functional</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col justify-center h-[160px]">
                                    {projectVsFunctionalData.length === 0 ? (
                                        <div className="text-center py-4 text-muted-foreground">데이터가 없습니다.</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Horizontal Bar */}
                                            <div className="w-full h-10 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                                {projectVsFunctionalData.map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                                                        className="h-full flex items-center justify-center text-white font-bold text-base transition-all duration-500 relative group"
                                                        title={`${item.name}: ${item.value.toFixed(0)}h (${item.percentage}%)`}
                                                    >
                                                        {parseInt(item.percentage) > 10 && (
                                                            <span className="drop-shadow-md">{item.percentage}%</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Legend & Details */}
                                            <div className="flex justify-between px-2 text-sm">
                                                {projectVsFunctionalData.map((item, idx) => (
                                                    <div key={idx} className="flex flex-col items-center">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                                            <span className="font-medium">{item.name}</span>
                                                        </div>
                                                        <div className="font-bold">{item.value.toFixed(0)}h</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* WorkLog by Project */}
                            <Card className="flex-1">
                                <CardHeader>
                                    <CardTitle>{viewMode === 'weekly' ? '주간' : '월간'} 프로젝트별 WorkLog</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {projectList.length === 0 ? (
                                        <div className="text-center py-4 text-muted-foreground">데이터가 없습니다.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {projectList.slice(0, 5).map(proj => (
                                                <div key={proj.project_id} className="flex items-center gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium truncate" title={proj.project_name}>
                                                            {proj.project_code} - {proj.project_name}
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                                                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${Math.min((proj.hours / totalHours) * 100, 100)}%` }} />
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-medium w-10 text-right">{proj.hours.toFixed(0)}h</div>
                                                </div>
                                            ))}
                                            {projectList.length > 5 && (
                                                <div className="text-xs text-center text-muted-foreground pt-1">
                                                    + {projectList.length - 5} more
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: Work Type Pie Chart */}
                        <Card className="lg:col-span-2 flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    {drillDownPath.length > 0 ? (
                                        <>
                                            <button
                                                onClick={handleDrillUp}
                                                className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                                                title="뒤로가기"
                                            >
                                                ←
                                            </button>
                                            <span style={{ color: L1_CATEGORY_COLORS[drillDownPath[0]]?.color }}>
                                                {activeLabel}
                                            </span>
                                            <span className="text-muted-foreground text-sm font-normal">상세</span>
                                        </>
                                    ) : (
                                        <>{viewMode === 'weekly' ? '주간' : '월간'} 업무 유형별 비율</>
                                    )}
                                </CardTitle>
                                {drillDownPath.length < 2 && (
                                    <span className="text-xs text-muted-foreground">클릭하여 상세 보기</span>
                                )}
                            </CardHeader>
                            <CardContent>
                                {activeChartData.length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground">데이터가 없습니다.</div>
                                ) : (
                                    <div className="flex flex-col lg:flex-row items-center gap-6 justify-center">
                                        <div className="w-80 h-80 transition-all duration-300 flex-shrink-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={activeChartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={80}
                                                        outerRadius={120}
                                                        paddingAngle={2}
                                                        dataKey="value"
                                                        animationDuration={400}
                                                        onClick={(data) => {
                                                            if (drillDownPath.length < 2 && data.code) {
                                                                setDrillDownPath(prev => [...prev, data.code]);
                                                            }
                                                        }}
                                                        style={{ cursor: drillDownPath.length < 2 ? 'pointer' : 'default' }}
                                                    >
                                                        {activeChartData.map((entry, index) => (
                                                            <Cell
                                                                key={`cell-${index}`}
                                                                fill={entry.color}
                                                                className={drillDownPath.length < 2 ? 'hover:opacity-80 transition-opacity' : ''}
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        formatter={(value: number | undefined) => [
                                                            `${(value ?? 0).toFixed(0)}h`,
                                                            '시간'
                                                        ]}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex-1 space-y-3 min-w-[280px]">
                                            {activeChartData.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`flex items-center gap-3 p-2 rounded-lg transition-all ${drillDownPath.length < 2 ? 'hover:bg-slate-50 cursor-pointer' : ''
                                                        }`}
                                                    onClick={() => {
                                                        if (drillDownPath.length < 2 && item.code) {
                                                            setDrillDownPath(prev => [...prev, item.code]);
                                                        }
                                                    }}
                                                >
                                                    <div
                                                        className="w-4 h-4 rounded-full"
                                                        style={{ backgroundColor: item.color }}
                                                    />
                                                    <span className="flex-1 font-medium">{item.name}</span>
                                                    <span className="font-bold text-lg">{item.value.toFixed(0)}h</span>
                                                    <span className="text-muted-foreground bg-slate-100 px-2 py-0.5 rounded text-sm">
                                                        {item.percentage}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>


                    {/* My Projects Timeline */}
                    <Card>
                        <CardHeader>
                            <CardTitle>참여 프로젝트 현황</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.my_projects.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground">참여 중인 프로젝트가 없습니다.</div>
                            ) : (
                                <div className="space-y-4">
                                    {data.my_projects.map(project => (
                                        <div key={project.id} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-medium">{project.code} - {project.name}</h3>
                                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${project.status === 'WIP' ? 'bg-green-100 text-green-700' :
                                                        project.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                                                            project.status === 'Hold' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'
                                                        }`}>
                                                        {project.status}
                                                    </span>
                                                </div>
                                            </div>
                                            {project.milestones.length > 0 && (
                                                <div className="flex gap-4 mt-3 text-sm">
                                                    {project.milestones.map((m, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${m.status === 'Completed' ? 'bg-green-500 text-white' :
                                                                m.status === 'At risk' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                                                                }`}>
                                                                {m.name.substring(0, 2)}
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                {m.target_date ? format(new Date(m.target_date), 'yy-MMM') : '-'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="team" className="space-y-6">
                    <TeamDashboardContent
                        teamScope={teamScope}
                        setTeamScope={setTeamScope}
                        teamViewMode={teamViewMode}
                        setTeamViewMode={setTeamViewMode}
                    />
                </TabsContent>

                <TabsContent value="project" className="py-8">
                    <Card className="w-full max-w-md mx-auto text-center">
                        <CardHeader>
                            <div className="flex justify-center mb-4">
                                <div className="p-4 bg-slate-100 rounded-full">
                                    <Construction className="w-12 h-12 text-slate-500" />
                                </div>
                            </div>
                            <CardTitle className="text-2xl font-bold">Coming Soon</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-slate-500">
                                Project 대시보드는 준비 중입니다.<br />
                                곧 업데이트될 예정입니다.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default DashboardPage;
