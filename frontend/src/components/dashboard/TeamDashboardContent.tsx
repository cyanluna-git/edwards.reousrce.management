import React from 'react';
import { useTeamDashboard } from '@/hooks/useDashboard';
import type { TeamDashboardScope, DashboardViewMode } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { Users, Building, Building2 } from 'lucide-react';

// Team Dashboard Scope Labels
const SCOPE_LABELS: Record<TeamDashboardScope, { label: string; icon: React.ReactNode }> = {
    sub_team: { label: '소그룹', icon: <Users className="w-4 h-4" /> },
    department: { label: '부서', icon: <Building className="w-4 h-4" /> },
    business_unit: { label: '사업부', icon: <Building2 className="w-4 h-4" /> },
    all: { label: '전체', icon: <Building2 className="w-4 h-4" /> },
};

interface TeamDashboardContentProps {
    teamScope: TeamDashboardScope;
    setTeamScope: (scope: TeamDashboardScope) => void;
    teamViewMode: DashboardViewMode;
    setTeamViewMode: (mode: DashboardViewMode) => void;
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
    setTeamViewMode,
}) => {
    const { data: teamData, isLoading: teamLoading, error: teamError } = useTeamDashboard(teamScope, teamViewMode);

    if (teamLoading) {
        return <div className="text-center py-12">팀 데이터 로딩 중...</div>;
    }

    if (teamError || !teamData) {
        return <div className="text-center py-12 text-red-500">팀 대시보드를 불러오는데 실패했습니다.</div>;
    }

    const { team_info, date_range, team_worklogs, member_contributions, sub_org_contributions, resource_allocation, org_context } = teamData;
    const projectVsFunctionalTotal = team_worklogs.project_vs_functional.Project + team_worklogs.project_vs_functional.Functional;
    const projectPercent = projectVsFunctionalTotal > 0
        ? Math.round((team_worklogs.project_vs_functional.Project / projectVsFunctionalTotal) * 100)
        : 0;
    const functionalPercent = 100 - projectPercent;

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
                <div className="h-6 w-px bg-slate-200" />
                <div className="flex gap-2">
                    <Button variant={teamViewMode === 'weekly' ? 'default' : 'outline'} onClick={() => setTeamViewMode('weekly')} size="sm">📅 이번 주</Button>
                    <Button variant={teamViewMode === 'monthly' ? 'default' : 'outline'} onClick={() => setTeamViewMode('monthly')} size="sm">📆 이번 달</Button>
                    <Button variant={teamViewMode === 'quarterly' ? 'default' : 'outline'} onClick={() => setTeamViewMode('quarterly')} size="sm">📊 이번 분기</Button>
                    <Button variant={teamViewMode === 'yearly' ? 'default' : 'outline'} onClick={() => setTeamViewMode('yearly')} size="sm">🗓️ 올해</Button>
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

            {/* Project vs Functional Bar */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">프로젝트 vs 기능 업무</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <div
                            className="h-8 bg-blue-500 rounded-l flex items-center justify-center text-white text-xs font-medium"
                            style={{ width: `${projectPercent}%`, minWidth: projectPercent > 0 ? '40px' : '0' }}
                        >
                            {projectPercent > 10 && `${projectPercent}%`}
                        </div>
                        <div
                            className="h-8 bg-amber-500 rounded-r flex items-center justify-center text-white text-xs font-medium"
                            style={{ width: `${functionalPercent}%`, minWidth: functionalPercent > 0 ? '40px' : '0' }}
                        >
                            {functionalPercent > 10 && `${functionalPercent}%`}
                        </div>
                    </div>
                    <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-blue-500" />
                            프로젝트 {team_worklogs.project_vs_functional.Project.toFixed(0)}h
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-amber-500" />
                            기능 {team_worklogs.project_vs_functional.Functional.toFixed(0)}h
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Top Projects */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">프로젝트별 시간</CardTitle>
                </CardHeader>
                <CardContent>
                    {team_worklogs.by_project.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">프로젝트 데이터가 없습니다.</div>
                    ) : (
                        <div className="space-y-2">
                            {team_worklogs.by_project.slice(0, 10).map(p => {
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
                            {teamScope === 'department' ? '소그룹별 기여도' : teamScope === 'business_unit' ? '부서별 기여도' : '하위 조직 기여도'}
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
