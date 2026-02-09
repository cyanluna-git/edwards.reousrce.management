import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTeamDashboard } from '@/hooks/useDashboard';
import type { TeamDashboardScope, DashboardViewMode } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui';
import { Users, Building, Building2, Maximize2 } from 'lucide-react';
import { WeeklySummaryCard } from './WeeklySummaryCard';

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
    const { t } = useTranslation('dashboard');
    const { data: teamData, isLoading: teamLoading, error: teamError } = useTeamDashboard(teamScope, teamViewMode, dateRange);

    // Team Dashboard Scope Labels (inside component to access t())
    const SCOPE_LABELS: Record<TeamDashboardScope, { label: string; icon: React.ReactNode }> = {
        sub_team: { label: t('team.scopeSubTeam'), icon: <Users className="w-4 h-4" /> },
        department: { label: t('team.scopeDepartment'), icon: <Building className="w-4 h-4" /> },
        business_unit: { label: t('team.scopeBusinessUnit'), icon: <Building2 className="w-4 h-4" /> },
        all: { label: t('team.scopeAll'), icon: <Building2 className="w-4 h-4" /> },
    };

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
        return <div className="text-center py-12">{t('team.loading')}</div>;
    }

    if (teamError || !teamData) {
        return <div className="text-center py-12 text-red-500">{t('team.loadFailed')}</div>;
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
        { key: 'Product', label: t('category.product'), hours: byCategory.Product, color: 'bg-blue-500', textColor: 'text-blue-500' },
        { key: 'Functional', label: t('category.functional'), hours: byCategory.Functional, color: 'bg-amber-500', textColor: 'text-amber-500' },
        { key: 'Support', label: t('category.support'), hours: byCategory.Support, color: 'bg-green-500', textColor: 'text-green-500' },
        { key: 'TeamInternal', label: t('category.team'), hours: byCategory.TeamInternal, color: 'bg-slate-400', textColor: 'text-slate-500' },
    ].map(cat => ({
        ...cat,
        percent: categoryTotal > 0 ? Math.round((cat.hours / categoryTotal) * 100) : 0,
    })).filter(cat => cat.hours > 0);

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
                            <p className="text-teal-100 mt-1">{t('team.memberCount', { count: team_info.member_count })}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-teal-100 text-sm">{date_range.start} ~ {date_range.end}</p>
                            <p className="text-3xl font-bold mt-1">{team_worklogs.total_hours.toFixed(0)}h</p>
                            <p className="text-teal-100 text-sm">{t('team.engineeringRatio', { percent: org_context.team_percentage })}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('team.teamWorklog')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{team_worklogs.total_hours.toFixed(0)}h</div>
                        <p className="text-xs text-muted-foreground mt-1">{date_range.start} ~ {date_range.end}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('team.activeProjects')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{t('team.projectCountValue', { count: resource_allocation.active_projects })}</div>
                        <p className="text-xs text-muted-foreground mt-1">{resource_allocation.current_month}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('team.teamAllocation')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{resource_allocation.total_planned_fte.toFixed(1)} FTE</div>
                        <p className="text-xs text-muted-foreground mt-1">{resource_allocation.current_month} {t('team.resourcePlan')}</p>
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
                    <CardTitle className="text-sm font-medium">{t('team.workTypeHours')}</CardTitle>
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
                    <CardTitle className="text-sm font-medium">{t('team.projectRatio')}</CardTitle>
                    {hasMoreProjects && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-1">
                                    <Maximize2 className="w-3 h-3" />
                                    {t('team.viewAll')}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{t('team.projectRatioFull', { count: productFunctionalProjects.length })}</DialogTitle>
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
                        <div className="text-center py-4 text-muted-foreground">{t('team.noProjectData')}</div>
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
                            {teamScope === 'department' ? t('team.subTeamContribution') : teamScope === 'business_unit' ? t('team.departmentContribution') : t('team.subOrgGeneric')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {sub_org_contributions.map(org => (
                                <div key={org.org_id} className="flex items-center gap-3">
                                    <div className="w-32 truncate">
                                        <span className="text-sm font-medium">{org.org_name}</span>
                                        <span className="text-xs text-muted-foreground ml-1">{t('team.memberCountBadge', { count: org.member_count })}</span>
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
                    <CardTitle className="text-sm font-medium">{t('team.memberContribution')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {member_contributions.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">{t('team.noMemberData')}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-2">{t('team.name')}</th>
                                        <th className="text-right py-2 px-2">{t('team.hours')}</th>
                                        <th className="text-right py-2 px-2">{t('team.ratio')}</th>
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
                                    {t('team.nMore', { count: member_contributions.length - 10 })}
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
