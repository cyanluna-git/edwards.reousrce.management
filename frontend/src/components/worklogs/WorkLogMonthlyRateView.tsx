import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMonthlyWorklogCompletion } from '@/hooks/useWorklogs';
import { useAuth } from '@/hooks/useAuth';
import {
    Department,
    SubTeam,
    UserDetails,
    getDepartments,
    getSubTeams,
    getUsers,
} from '@/api/client';

function formatRate(rate: number) {
    return `${rate.toFixed(1)}%`;
}

export function MyMonthlyRateCard() {
    const { t } = useTranslation('worklogs');
    const { user } = useAuth();
    const currentMonth = format(new Date(), 'yyyy-MM');
    const { data, isLoading, error } = useMonthlyWorklogCompletion({
        month: currentMonth,
        user_id: user?.id,
        enabled: Boolean(user?.id),
    });

    const myEntry = data?.entries[0];

    return (
        <Card>
            <CardHeader className="py-3">
                <CardTitle className="text-base">{t('completion.myMonthlyTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="py-3">
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">{t('completion.loading')}</div>
                ) : error ? (
                    <div className="text-sm text-red-500">{t('completion.loadError')}</div>
                ) : !myEntry ? (
                    <div className="text-sm text-muted-foreground">{t('completion.noPersonalData')}</div>
                ) : (
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">
                                {t('completion.thisMonthBusinessDays', {
                                    month: currentMonth,
                                    count: myEntry.business_days,
                                })}
                            </div>
                            <div className="text-3xl font-bold text-primary">
                                {formatRate(myEntry.completion_rate)}
                            </div>
                        </div>
                        <div className="grid gap-1 text-sm text-right">
                            <div>
                                <span className="text-muted-foreground">{t('completion.completedDays')}:</span>{' '}
                                <span className="font-medium">
                                    {myEntry.completed_days} / {myEntry.business_days}
                                </span>
                            </div>
                            <div className="text-muted-foreground">{t('completion.entryTabHint')}</div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function WorkLogMonthlyRateView() {
    const { t } = useTranslation('worklogs');

    const [departments, setDepartments] = useState<Department[]>([]);
    const [subTeams, setSubTeams] = useState<SubTeam[]>([]);
    const [users, setUsers] = useState<UserDetails[]>([]);

    const [completionMonth, setCompletionMonth] = useState(() =>
        format(new Date(), 'yyyy-MM')
    );
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [subTeamFilter, setSubTeamFilter] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [userSearch, setUserSearch] = useState('');

    useEffect(() => {
        getDepartments().then(setDepartments);
        getUsers().then(setUsers);
    }, []);

    useEffect(() => {
        if (departmentFilter) {
            getSubTeams(departmentFilter).then(setSubTeams);
            return;
        }
        setSubTeams([]);
        setSubTeamFilter('');
    }, [departmentFilter]);

    const filteredUsers = useMemo(() => {
        let result = users;
        if (departmentFilter) {
            result = result.filter((candidate) => candidate.department_id === departmentFilter);
        }
        if (subTeamFilter) {
            result = result.filter((candidate) => candidate.sub_team_id === subTeamFilter);
        }
        return result;
    }, [users, departmentFilter, subTeamFilter]);

    const { data: completionSummary, isLoading, error } = useMonthlyWorklogCompletion({
        month: completionMonth,
        department_id: departmentFilter || undefined,
        sub_team_id: subTeamFilter || undefined,
        user_id: userFilter || undefined,
        user_query: userSearch || undefined,
        enabled: Boolean(completionMonth),
    });

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-base">{t('completion.title')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">{t('completion.month')}:</span>
                        <Input
                            type="month"
                            value={completionMonth}
                            onChange={(e) => setCompletionMonth(e.target.value)}
                            className="w-40 h-8"
                        />
                        <span className="text-sm text-muted-foreground">
                            {t('completion.businessDays', { count: completionSummary?.business_days ?? 0 })}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">{t('table.org')}:</span>
                        <select
                            className="px-2 py-1 border rounded-md text-sm h-8"
                            value={departmentFilter}
                            onChange={(e) => {
                                setDepartmentFilter(e.target.value);
                                setSubTeamFilter('');
                                setUserFilter('');
                            }}
                        >
                            <option value="">{t('table.allDepartments')}</option>
                            {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                    {department.name}
                                </option>
                            ))}
                        </select>
                        <select
                            className="px-2 py-1 border rounded-md text-sm h-8"
                            value={subTeamFilter}
                            onChange={(e) => {
                                setSubTeamFilter(e.target.value);
                                setUserFilter('');
                            }}
                            disabled={!departmentFilter}
                        >
                            <option value="">{t('table.allSubTeams')}</option>
                            {subTeams.map((subTeam) => (
                                <option key={subTeam.id} value={subTeam.id}>
                                    {subTeam.name}
                                </option>
                            ))}
                        </select>
                        <select
                            className="px-2 py-1 border rounded-md text-sm h-8 min-w-[150px]"
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                        >
                            <option value="">{t('table.allUsers')}</option>
                            {filteredUsers.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                    {candidate.korean_name || candidate.name}
                                </option>
                            ))}
                        </select>
                        <Input
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            placeholder={t('completion.userSearchPlaceholder')}
                            className="h-8 w-48"
                        />
                    </div>

                    {isLoading ? (
                        <div className="text-sm text-muted-foreground">{t('completion.loading')}</div>
                    ) : error ? (
                        <div className="text-sm text-red-500">{t('completion.loadError')}</div>
                    ) : !completionSummary || completionSummary.entries.length === 0 ? (
                        <div className="text-sm text-muted-foreground">{t('completion.noData')}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left p-2 whitespace-nowrap">{t('table.user')}</th>
                                        <th className="text-left p-2 whitespace-nowrap">{t('table.org')}</th>
                                        <th className="text-right p-2 whitespace-nowrap">{t('completion.completedDays')}</th>
                                        <th className="text-right p-2 whitespace-nowrap">{t('completion.rate')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {completionSummary.entries.map((entry) => (
                                        <tr key={entry.user_id} className="border-t">
                                            <td className="p-2 whitespace-nowrap">
                                                <div className="font-medium">{entry.user_korean_name || entry.user_name}</div>
                                                {entry.user_korean_name && (
                                                    <div className="text-xs text-muted-foreground">{entry.user_name}</div>
                                                )}
                                            </td>
                                            <td className="p-2 whitespace-nowrap">
                                                {entry.sub_team_name || entry.department_name || '-'}
                                            </td>
                                            <td className="p-2 text-right">
                                                {entry.completed_days} / {entry.business_days}
                                            </td>
                                            <td className="p-2 text-right font-medium">
                                                {formatRate(entry.completion_rate)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
