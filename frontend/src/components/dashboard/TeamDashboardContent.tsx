import React, { useMemo } from 'react';
import { useTeamDashboard } from '@/hooks/useDashboard';
import type { TeamDashboardScope, DashboardViewMode } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui';
import { Users, Building, Building2, Maximize2 } from 'lucide-react';
import { WeeklySummaryCard } from './WeeklySummaryCard';

// Team Dashboard Scope Labels
const SCOPE_LABELS: Record<TeamDashboardScope, { label: string; icon: React.ReactNode }> = {
    sub_team: { label: 'Sub-Team', icon: <Users className="w-4 h-4" /> },
    department: { label: '부서', icon: <Building className="w-4 h-4" /> },
    business_unit: { label: '사업부', icon: <Building2 className="w-4 h-4" /> },
    all: { label: '전체', icon: <Building2 className="w-4 h-4" /> },
};

interface TeamDashboardContentProps {
    teamScope: TeamDashboardScope;
    setTeamScope: (scope: TeamDashboardScope) => void;
    teamViewMode: DashboardViewMode;
    setTeamViewMode: (mode: DashboardViewMode) => void;
    dateRange?: { start: string; end: string };
}

/**
 * Team Dashboard Content Component
 * Displays team-level worklog summaries, project distribution,
 * and member contributions with scope/view mode selectors
 */
export const TeamDashboardContent: React.FC<TeamDashboardContentProps> = ({
    teamScope,
    setTeamScope,
    teamViewMode,
    setTeamViewMode: _setTeamViewMode,
    dateRange,
}) => {
    void _setTeamViewMode; // Reserved for future use
    const { data: teamData, isLoading: teamLoading, error: teamError } = useTeamDashboard(teamScope, teamViewMode, dateRange);

    // IMPORTANT: useMemo must be called BEFORE any early returns to satisfy Rules of Hooks
    // React requires hooks to be called in the same order on every render
    const productFunctionalProjects = useMemo(() => {
        if (!teamData?.team_worklogs?.by_project) return [];
        return teamData.team_worklogs.by_project
            .filter(p => p.category === 'PRODUCT' || p.category === 'FUNCTIONAL')
            .sort((a, b) => b.hours - a.hours);
    }, [teamData?.team_worklogs?.by_project]);

    // Early returns AFTER all hooks
    if (teamLoading) {
        return <div className="text-center py-12">팀 데이터 로딩 중...</div>;
    }

    if (teamError || !teamData) {
        return <div className="text-center py-12 text-red-500">팀 대시보드를 불러오는데 실패했습니다.</div>;
    }

    const { team_info, date_range, team_worklogs, member_contributions, sub_org_contributions, resource_allocation, org_context } = teamData;

    // New: 4-category distribution (Product, Functional, Support, TeamInternal)
    const byCategory = team_worklogs.by_category || {
        Product: team_worklogs.project_vs_functional?.Project || 0,
        Functional: team_worklogs.project_vs_functional?.Functional || 0,
        Support: 0,
        TeamInternal: 0,
    };
    const categoryTotal = byCategory.Product + byCategory.Functional + byCategory.Support + byCategory.TeamInternal;

    const categoryData = [
        { key: 'Product', label: 'Product', hours: byCategory.Product, color: 'bg-blue-500', textColor: 'text-blue-500' },
        { key: 'Functional', label: 'Functional', hours: byCategory.Functional, color: 'bg-amber-500', textColor: 'text-amber-500' },
        { key: 'Support', label: 'Support', hours: byCategory.Support, color: 'bg-green-500', textColor: 'text-green-500' },
        { key: 'TeamInternal', label: 'Team', hours: byCategory.TeamInternal, color: 'bg-slate-400', textColor: 'text-slate-500' },
    ].map(cat => ({
        ...cat,
        percent: categoryTotal > 0 ? Math.round((cat.hours / categoryTotal) * 100) : 0,
    })).filter(cat => cat.hours > 0); // 0시간 카테고리는 숨김

    const top5Projects = productFunctionalProjects.slice(0, 5);
    const hasMoreProjects = productFunctionalProjects.length > 5;

    return (
        <>
            {/* Scope Selector */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex gap-2">
                    {(['sub_team', 'department', 'business_unit', 'all'] as TeamDashboardScope[]).map(scope => (
                        <Button
                            key={scope}
                            variant={teamScope === scope ? 'default' : 'outline'}
                            onClick={() => setTeamScope(scope)}
                            size="sm"
                            className="gap-1"
                        >
                            {SCOPE_LABELS[scope].icon}
                            {SCOPE_LABELS[scope].label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Team Info Header */}
            <Card className="bg-gradient-to-r from-teal-600 to-teal-800 text-white">
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-teal-100 text-sm">{team_info.org_path.join(' > ')}</p>
                            <h2 className="text-2xl font-bold mt-1">{team_info.name}</h2>
                            <p className="text-teal-100 mt-1">👥 {team_info.member_count}명</p>
                        </div>
                        <div className="text-right">
                            <p className="text-teal-100 text-sm">{date_range.start} ~ {date_range.end}</p>
                            <p className="text-3xl font-bold mt-1">{team_worklogs.total_hours.toFixed(0)}h</p>
                            <p className="text-teal-100 text-sm">Engineering 대비 {org_context.team_percentage}%</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">팀 WorkLog</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{team_worklogs.total_hours.toFixed(0)}h</div>
                        <p className="text-xs text-muted-foreground mt-1">{date_range.start} ~ {date_range.end}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">활성 프로젝트</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{resource_allocation.active_projects}개</div>
                        <p className="text-xs text-muted-foreground mt-1">{resource_allocation.current_month}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">팀 배정량</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{resource_allocation.total_planned_fte.toFixed(1)} FTE</div>
                        <p className="text-xs text-muted-foreground mt-1">{resource_allocation.current_month} 리소스 플랜</p>
                    </CardContent>
                </Card>
            </div>

            {/* AI Weekly Summary Card */}
            <WeeklySummaryCard
                mode="team"
                scope={teamScope}
                period={teamViewMode === 'weekly' ? 'weekly' : 'monthly'}
            />

            {/* Category Distribution Bar */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">업무 유형별 시간</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Stacked Bar */}
                    <div className="flex items-center rounded-lg overflow-hidden h-10">
                        {categoryData.map((cat) => (
                            <div
                                key={cat.key}
                                className={`h-full ${cat.color} flex items-center justify-center text-white text-xs font-medium transition-all`}
                                style={{
                                    width: `${cat.percent}%`,
                                    minWidth: cat.percent > 0 ? '32px' : '0',
                                }}
                                title={`${cat.label}: ${cat.hours.toFixed(0)}h (${cat.percent}%)`}
                            >
                                {cat.percent >= 12 && `${cat.percent}%`}
                            </div>
                        ))}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm">
                        {categoryData.map(cat => (
                            <span key={cat.key} className="flex items-center gap-1.5">
                                <span className={`w-3 h-3 rounded-full ${cat.color}`} />
                                <span className={cat.textColor}>{cat.label}</span>
                                <span className="text-muted-foreground">{cat.hours.toFixed(0)}h</span>
                            </span>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Top Projects (Product + Functional only) */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">프로젝트별 비중</CardTitle>
                    {hasMoreProjects && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-1">
                                    <Maximize2 className="w-3 h-3" />
                                    전체 보기
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>프로젝트별 비중 (전체 {productFunctionalProjects.length}개)</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-2 mt-4">
                                    {productFunctionalProjects.map(p => {
                                        const percent = team_worklogs.total_hours > 0
                                            ? Math.round((p.hours / team_worklogs.total_hours) * 100)
                                            : 0;
                                        return (
                                            <div key={p.project_id} className="flex items-center gap-2">
                                                <div className="w-48 truncate text-sm font-medium" title={`${p.project_code} - ${p.project_name}`}>
                                                    {p.project_name || p.project_code}
                                                </div>
                                                <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                                                    <div
                                                        className="bg-teal-500 h-full rounded-full"
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                                <div className="w-16 text-right text-sm">{p.hours.toFixed(0)}h</div>
                                                <div className="w-12 text-right text-xs text-muted-foreground">{percent}%</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent>
                    {top5Projects.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">프로젝트 데이터가 없습니다.</div>
                    ) : (
                        <div className="space-y-2">
                            {top5Projects.map(p => {
                                const percent = team_worklogs.total_hours > 0
                                    ? Math.round((p.hours / team_worklogs.total_hours) * 100)
                                    : 0;
                                return (
                                    <div key={p.project_id} className="flex items-center gap-2">
                                        <div className="w-40 truncate text-sm font-medium" title={`${p.project_code} - ${p.project_name}`}>
                                            {p.project_name || p.project_code}
                                        </div>
                                        <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                                            <div
                                                className="bg-teal-500 h-full rounded-full"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <div className="w-16 text-right text-sm">{p.hours.toFixed(0)}h</div>
                                        <div className="w-12 text-right text-xs text-muted-foreground">{percent}%</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Sub-Organization Contributions (for department/business_unit scopes) */}
            {sub_org_contributions && sub_org_contributions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">
                            {teamScope === 'department' ? 'Sub-Team별 기여도' : teamScope === 'business_unit' ? '부서별 기여도' : '하위 조직 기여도'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {sub_org_contributions.map(org => (
                                <div key={org.org_id} className="flex items-center gap-3">
                                    <div className="w-32 truncate">
                                        <span className="text-sm font-medium">{org.org_name}</span>
                                        <span className="text-xs text-muted-foreground ml-1">({org.member_count}명)</span>
                                    </div>
                                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                                        <div
                                            className="bg-indigo-500 h-full rounded-full flex items-center justify-end pr-2"
                                            style={{ width: `${Math.max(org.percentage, 5)}%` }}
                                        >
                                            {org.percentage >= 15 && (
                                                <span className="text-[10px] text-white font-medium">{org.percentage}%</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-16 text-right text-sm font-medium">{org.hours.toFixed(0)}h</div>
                                    <div className="w-12 text-right">
                                        <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs">
                                            {org.percentage}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Member Contributions */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">팀원 기여도</CardTitle>
                </CardHeader>
                <CardContent>
                    {member_contributions.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">팀원 데이터가 없습니다.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-2">이름</th>
                                        <th className="text-right py-2 px-2">시간</th>
                                        <th className="text-right py-2 px-2">비율</th>
                                        <th className="py-2 px-2 w-1/3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {member_contributions.slice(0, 10).map((member) => (
                                        <tr key={member.user_id} className="border-b last:border-0 hover:bg-slate-50">
                                            <td className="py-2 px-2">
                                                <span className="font-medium">{member.korean_name || member.name}</span>
                                                {member.korean_name && (
                                                    <span className="text-muted-foreground ml-1 text-xs">({member.name})</span>
                                                )}
                                            </td>
                                            <td className="text-right py-2 px-2 font-medium">{member.hours.toFixed(0)}h</td>
                                            <td className="text-right py-2 px-2">
                                                <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-xs">
                                                    {member.percentage}%
                                                </span>
                                            </td>
                                            <td className="py-2 px-2">
                                                <div className="w-full bg-slate-100 rounded-full h-2">
                                                    <div
                                                        className="bg-teal-500 h-2 rounded-full transition-all"
                                                        style={{ width: `${member.percentage}%` }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {member_contributions.length > 10 && (
                                <div className="text-center text-sm text-muted-foreground mt-2">
                                    + {member_contributions.length - 10}명 더
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
};

export default TeamDashboardContent;
