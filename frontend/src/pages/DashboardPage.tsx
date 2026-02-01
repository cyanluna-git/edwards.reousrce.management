import React, { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useDashboard } from '@/hooks/useDashboard';
import type { TeamDashboardScope, DashboardViewMode } from '@/api/client';
import { useWorklogsTable } from '@/hooks/useWorklogs';
import { useWorkTypeCategories, type WorkTypeCategory } from '@/hooks/useWorkTypeCategories';
import { Card, CardContent, CardHeader, CardTitle, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { Construction } from 'lucide-react';
import { L1_CATEGORY_COLORS, L2_COLORS } from '@/lib/constants';
import { TeamDashboardContent } from '@/components/dashboard/TeamDashboardContent';

type ViewMode = 'weekly' | 'monthly' | 'quarterly' | 'halfYear' | 'yearly';

// Type for category map entry with parent reference
interface CategoryEntry extends WorkTypeCategory {
    parent?: CategoryEntry;
}

// IMPORTANT: Calculate date ranges ONCE outside component to prevent infinite re-renders
// This ensures referential equality across re-renders and prevents useQuery refetch loops
const getStaticDateRanges = () => {
    const now = new Date();
    return {
        weekStart: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        weekEnd: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        monthStart: format(startOfMonth(now), 'yyyy-MM-dd'),
        monthEnd: format(endOfMonth(now), 'yyyy-MM-dd'),
        quarterStart: format(startOfQuarter(now), 'yyyy-MM-dd'),
        quarterEnd: format(endOfQuarter(now), 'yyyy-MM-dd'),
        halfYearStart: format(subMonths(startOfMonth(now), 5), 'yyyy-MM-dd'),
        halfYearEnd: format(endOfMonth(now), 'yyyy-MM-dd'),
        yearStart: format(startOfYear(now), 'yyyy-MM-dd'),
        yearEnd: format(endOfYear(now), 'yyyy-MM-dd'),
        last12MonthsStart: format(subMonths(startOfMonth(now), 11), 'yyyy-MM-dd'),
        last12MonthsEnd: format(endOfMonth(now), 'yyyy-MM-dd'),
    };
};

// Static date ranges - reference never changes after module load
const STATIC_DATE_RANGES = getStaticDateRanges();

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

    // Use static date ranges from module-level constant (reference never changes)
    const { weekStart, weekEnd, monthStart, monthEnd, quarterStart, quarterEnd,
        halfYearStart, halfYearEnd, yearStart, yearEnd, last12MonthsStart, last12MonthsEnd } = STATIC_DATE_RANGES;

    const { data: weeklyWorklogs = [], isLoading: weeklyLoading } = useWorklogsTable({
        start_date: weekStart,
        end_date: weekEnd,
        user_id: user?.id,
        limit: 100,
        enabled: true, // Always load weekly data
    });

    const { data: monthlyWorklogs = [], isLoading: monthlyLoading } = useWorklogsTable({
        start_date: monthStart,
        end_date: monthEnd,
        user_id: user?.id,
        limit: 200,
        enabled: true, // Always load monthly data
    });

    const { data: quarterlyWorklogs = [], isLoading: _quarterlyLoading } = useWorklogsTable({
        start_date: quarterStart,
        end_date: quarterEnd,
        user_id: user?.id,
        limit: 500,
        enabled: viewMode === 'quarterly' || viewMode === 'halfYear' || viewMode === 'yearly', // Load when needed
    });

    const { data: halfYearWorklogs = [], isLoading: _halfYearLoading } = useWorklogsTable({
        start_date: halfYearStart,
        end_date: halfYearEnd,
        user_id: user?.id,
        limit: 1000,
        enabled: viewMode === 'halfYear' || viewMode === 'yearly', // Load when needed
    });

    const { data: yearlyWorklogs = [], isLoading: _yearlyLoading } = useWorklogsTable({
        start_date: yearStart,
        end_date: yearEnd,
        user_id: user?.id,
        limit: 2000,
        enabled: viewMode === 'yearly', // Load when needed
    });

    // Last 12 months data for trend chart
    const { data: last12MonthsWorklogs = [] } = useWorklogsTable({
        start_date: last12MonthsStart,
        end_date: last12MonthsEnd,
        user_id: user?.id,
        limit: 2000,
        enabled: true, // Always load for trend chart
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
    // Calculate total hours and project summary with useMemo to prevent infinite re-renders
    const { totalHours, projectList } = useMemo(() => {
        const total = currentWorklogs.reduce((sum, wl) => sum + wl.hours, 0);

        // Group by project
        const projectSummary = currentWorklogs.reduce((acc, wl) => {
            const key = wl.project_id || 'non-project';
            if (!acc[key]) {
                // For worklogs without project, display as "Team" instead of "-"
                const isTeamWork = !wl.project_id;
                acc[key] = {
                    project_id: wl.project_id || 'non-project',
                    project_code: isTeamWork ? '' : (wl.project_code || ''),
                    project_name: isTeamWork ? 'Team' : (wl.project_name || ''),
                    hours: 0
                };
            }
            acc[key].hours += wl.hours;
            return acc;
        }, {} as Record<string, { project_id: string; project_code: string; project_name: string; hours: number }>);
        const allProjects = Object.values(projectSummary).sort((a, b) => b.hours - a.hours);

        // Top 5 projects + Others (but show all 6 if there are exactly 6)
        const TOP_N = 5;
        const topProjects = allProjects.slice(0, TOP_N);
        const otherProjects = allProjects.slice(TOP_N);
        const otherHours = otherProjects.reduce((sum, p) => sum + p.hours, 0);

        // Better UX: if there's only 1 "other" project, just show all 6 instead of grouping
        const list = otherProjects.length === 1
            ? allProjects // Show all 6 projects
            : otherHours > 0
                ? [...topProjects, { project_id: 'others', project_code: '기타', project_name: `${otherProjects.length}개 프로젝트`, hours: otherHours }]
                : topProjects;

        return { totalHours: total, projectList: list };
    }, [currentWorklogs]);

    // Build Category Map for easy lookup [Code -> Category Object]
    const categoryMap = useMemo(() => {
        if (!categoryTree || categoryTree.length === 0) return {};

        const map: Record<string, CategoryEntry> = {};

        const traverse = (cats: WorkTypeCategory[], parentCat?: CategoryEntry) => {
            cats.forEach(cat => {
                // Use original object with parent reference - spread creates new object but preserves data structure
                const entry: CategoryEntry = {
                    ...cat,
                    parent: parentCat
                };
                map[cat.code] = entry;
                if (cat.children && cat.children.length > 0) {
                    traverse(cat.children, entry);
                }
            });
        };

        traverse(categoryTree);
        console.log('[Dashboard] Category Map sample:', Object.keys(map).slice(0, 5).map(k => ({ code: k, cat: map[k] })));
        return map;
    }, [categoryTree]);

    // Calculate Work Type Distribution (4 categories)
    // Product, Functional, Support: from project.category
    // Team: worklogs without project_id (internal team activities)
    const workTypeCategoryData = useMemo(() => {
        const counts: Record<string, number> = {
            Product: 0,
            Functional: 0,
            Support: 0,
            Team: 0,
        };

        currentWorklogs.forEach(wl => {
            if (!wl.project_id) {
                // No project assigned = Team internal work
                counts.Team += wl.hours;
            } else {
                // Use project category
                const category = wl.project?.category?.toUpperCase() || 'PRODUCT';
                switch (category) {
                    case 'FUNCTIONAL':
                        counts.Functional += wl.hours;
                        break;
                    case 'SUPPORT':
                        counts.Support += wl.hours;
                        break;
                    default: // PRODUCT or any other
                        counts.Product += wl.hours;
                        break;
                }
            }
        });

        const total = Object.values(counts).reduce((a, b) => a + b, 0);

        const categoryConfig: Record<string, { color: string; label: string }> = {
            Product: { color: '#3b82f6', label: 'Product' },      // Blue
            Functional: { color: '#f59e0b', label: 'Functional' }, // Amber
            Support: { color: '#10b981', label: 'Support' },       // Green
            Team: { color: '#94a3b8', label: 'Team' },             // Slate
        };

        return Object.entries(counts)
            .filter(([_, value]) => value > 0) // Only show categories with hours
            .map(([name, value]) => ({
                name,
                label: categoryConfig[name].label,
                value,
                percentage: total > 0 ? ((value / total) * 100).toFixed(0) : '0',
                color: categoryConfig[name].color,
            }))
            .sort((a, b) => b.value - a.value);
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
        console.log('[Dashboard] Category ID to Code Map:', map);
        console.log('[Dashboard] Category Tree:', categoryTree);
        return map;
    }, [categoryTree]);


    // Determine Chart Data based on Drill Down Level
    // Level 0: L1 Distribution
    // Level 1: L2 Distribution (filtered by L1)
    // Level 2: L3 Distribution (filtered by L2)
    const activeChartData = useMemo(() => {
        const currentLevel = drillDownPath.length; // 0, 1, or 2
        const parentCode = currentLevel > 0 ? drillDownPath[currentLevel - 1] : null;

        // Debug: Log worklogs and their work_type_category info
        console.log(`[Dashboard ${viewMode}] Total worklogs:`, currentWorklogs.length);
        console.log(`[Dashboard ${viewMode}] Sample worklog:`, currentWorklogs[0]);
        if (currentWorklogs.length > 0) {
            const withCategory = currentWorklogs.filter(wl => wl.work_type_category_id).length;
            const withoutCategory = currentWorklogs.length - withCategory;
            console.log(`[Dashboard ${viewMode}] With category: ${withCategory}, Without: ${withoutCategory}`);
        }

        // Bucket accumulator
        const buckets: Record<string, { name: string; code: string; value: number; color?: string }> = {};

        currentWorklogs.forEach((wl, idx) => {
            // Determine WL's path
            let l1 = 'ADM'; // Default if no category
            let l2 = 'ADM-GEN';
            let l3 = 'ADM-GEN-OTH';
            let l1Name = '행정';
            let l2Name = '일반';
            let l3Name = '기타';

            // Debug first few worklogs
            if (idx < 3) {
                console.log(`[WL ${idx}] work_type_category_id:`, wl.work_type_category_id);
                console.log(`[WL ${idx}] work_type_category:`, wl.work_type_category);
            }

            // Try to resolve from ID first (New Logic)
            if (wl.work_type_category_id && categoryIdToCode[wl.work_type_category_id]) {
                const code = categoryIdToCode[wl.work_type_category_id];
                const cat = categoryMap[code];

                if (idx < 3) {
                    console.log(`[WL ${idx}] Found code: ${code}, cat:`, cat);
                }

                if (cat) {
                    if (cat.level === 3) {
                        l3 = cat.code; l3Name = cat.name_ko || cat.name;
                        if (cat.parent) {
                            l2 = cat.parent.code; l2Name = cat.parent.name_ko || cat.parent.name;
                            if (cat.parent.parent) {
                                l1 = cat.parent.parent.code; l1Name = cat.parent.parent.name_ko || cat.parent.parent.name;
                            }
                        }
                    } else if (cat.level === 2) {
                        l2 = cat.code; l2Name = cat.name_ko || cat.name;
                        if (cat.parent) {
                            l1 = cat.parent.code; l1Name = cat.parent.name_ko || cat.parent.name;
                        }
                    } else if (cat.level === 1) {
                        l1 = cat.code; l1Name = cat.name_ko || cat.name;
                    }

                    if (idx < 3) {
                        console.log(`[WL ${idx}] Resolved to L1: ${l1} (${l1Name})`);
                    }
                } else {
                    if (idx < 3) {
                        console.log(`[WL ${idx}] ❌ Category not found in categoryMap for code: ${code}`);
                    }
                }
            } else {
                if (idx < 3) {
                    console.log(`[WL ${idx}] ❌ No category ID or not in mapping`);
                }
            }
            // If still no valid category found, keep default ADM

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

    // Calculate monthly Top-5 project trend data
    const monthlyProjectTrendData = useMemo(() => {
        if (!last12MonthsWorklogs.length) return { chartData: [] as any[], topProjects: [] as string[] };

        // Group by month and project (use project name for display)
        const monthlyData: Record<string, Record<string, number>> = {};

        last12MonthsWorklogs.forEach(wl => {
            const monthKey = format(new Date(wl.date), 'yyyy-MM');
            const projectKey = wl.project_name || wl.project_code || '기타';

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {};
            }
            monthlyData[monthKey][projectKey] = (monthlyData[monthKey][projectKey] || 0) + wl.hours;
        });

        // Find overall top 5 projects (by total hours across all months)
        const projectTotals: Record<string, number> = {};
        Object.values(monthlyData).forEach(month => {
            Object.entries(month).forEach(([project, hours]) => {
                projectTotals[project] = (projectTotals[project] || 0) + hours;
            });
        });

        const topProjects = Object.entries(projectTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([project]) => project);

        // Build chart data
        const chartData = Object.entries(monthlyData)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, projects]) => {
                const dataPoint: any = { month };
                topProjects.forEach(project => {
                    dataPoint[project] = projects[project] || 0;
                });
                // Calculate "Others"
                const topTotal = topProjects.reduce((sum, p) => sum + (projects[p] || 0), 0);
                const allTotal = Object.values(projects).reduce((sum, h) => sum + h, 0);
                dataPoint['기타'] = allTotal - topTotal;
                return dataPoint;
            });

        return { chartData, topProjects };
    }, [last12MonthsWorklogs]);

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
                            {/* Work Type Category Distribution (Horizontal Bar) */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>{viewMode === 'weekly' ? '주간' : '월간'} 업무 유형별 비중</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col justify-center h-[180px]">
                                    {workTypeCategoryData.length === 0 ? (
                                        <div className="text-center py-4 text-muted-foreground">데이터가 없습니다.</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Horizontal Bar */}
                                            <div className="w-full h-10 bg-slate-100 rounded-lg overflow-hidden flex shadow-inner">
                                                {workTypeCategoryData.map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                                                        className="h-full flex items-center justify-center text-white font-bold text-sm transition-all duration-500 relative group"
                                                        title={`${item.label}: ${item.value.toFixed(0)}h (${item.percentage}%)`}
                                                    >
                                                        {parseInt(item.percentage) > 12 && (
                                                            <span className="drop-shadow-md">{item.percentage}%</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Legend & Details - Grid layout for 4 categories */}
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                {workTypeCategoryData.map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                                        <span className="font-medium truncate">{item.label}</span>
                                                        <span className="text-muted-foreground ml-auto">{item.value.toFixed(0)}h</span>
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
                                                            {proj.project_code ? `${proj.project_code} - ${proj.project_name}` : proj.project_name}
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
                                {weeklyLoading && viewMode === 'weekly' ? (
                                    <div className="text-center py-4 text-muted-foreground">로딩 중...</div>
                                ) : monthlyLoading && viewMode === 'monthly' ? (
                                    <div className="text-center py-4 text-muted-foreground">로딩 중...</div>
                                ) : activeChartData.length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground">
                                        데이터가 없습니다.
                                        <div className="text-xs mt-2">
                                            {viewMode === 'weekly' && `(${weekStart} ~ ${weekEnd})`}
                                            {viewMode === 'monthly' && `(${monthStart} ~ ${monthEnd})`}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col lg:flex-row items-center gap-6 justify-center">
                                        <div className="w-80 h-80 min-h-[320px] transition-all duration-300 flex-shrink-0 flex items-center justify-center">
                                            <PieChart width={320} height={320}>
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

                    {/* Monthly Top-5 Project Trend Chart */}
                    {monthlyProjectTrendData.chartData && monthlyProjectTrendData.chartData.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>월별 Top-5 프로젝트 투입 시간 추이</CardTitle>
                                <p className="text-xs text-muted-foreground mt-1">최근 12개월</p>
                            </CardHeader>
                            <CardContent className="h-[400px] min-h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={monthlyProjectTrendData.chartData}>
                                        <defs>
                                            {monthlyProjectTrendData.topProjects.map((project, idx) => {
                                                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                                                const color = colors[idx % colors.length];
                                                return (
                                                    <linearGradient key={project} id={`colorProject${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor={color} stopOpacity={0.3} />
                                                    </linearGradient>
                                                );
                                            })}
                                            <linearGradient id="colorOthers" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.6} />
                                                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.2} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="month"
                                            tick={{ fontSize: 12 }}
                                            tickFormatter={(value) => {
                                                const [, month] = value.split('-');
                                                return `${month}월`;
                                            }}
                                        />
                                        <YAxis
                                            label={{ value: '투입 시간 (h)', angle: -90, position: 'insideLeft' }}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                                            formatter={(value, name) => [`${(value as number)?.toFixed(0) ?? 0}h`, name]}
                                            labelFormatter={(label) => {
                                                const [year, month] = label.split('-');
                                                return `${year}년 ${month}월`;
                                            }}
                                        />
                                        <Legend
                                            wrapperStyle={{ paddingTop: '20px' }}
                                            iconType="rect"
                                        />
                                        {monthlyProjectTrendData.topProjects.map((project, idx) => {
                                            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                                            const color = colors[idx % colors.length];
                                            return (
                                                <Area
                                                    key={project}
                                                    type="monotone"
                                                    dataKey={project}
                                                    stackId="1"
                                                    stroke={color}
                                                    fill={`url(#colorProject${idx})`}
                                                    strokeWidth={2}
                                                />
                                            );
                                        })}
                                        <Area
                                            type="monotone"
                                            dataKey="기타"
                                            stackId="1"
                                            stroke="#94a3b8"
                                            fill="url(#colorOthers)"
                                            strokeWidth={1}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}


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
