/**
 * WorkLog Table View Component
 * Table view for all work logs with filters
 * Extracted from WorkLogTablePage for use as a tab
 */
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorklogsTable } from '@/hooks/useWorklogs';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { getBusinessUnits, getDepartments, getSubTeams, getUsers, BusinessUnit, Department, SubTeam, UserDetails } from '@/api/client';

export function WorkLogTableView() {
    const { t } = useTranslation('worklogs');
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';

    // Data for filters
    const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [subTeams, setSubTeams] = useState<SubTeam[]>([]);
    const [users, setUsers] = useState<UserDetails[]>([]);

    // Filter states - default to this week (7 days)
    const [startDate, setStartDate] = useState(() =>
        format(subDays(new Date(), 7), 'yyyy-MM-dd')
    );
    const [endDate, setEndDate] = useState(() =>
        format(new Date(), 'yyyy-MM-dd')
    );
    // 프로젝트 기반 필터
    const [businessUnitFilter, setBusinessUnitFilter] = useState<string>('');
    const [projectFilter, setProjectFilter] = useState<string>('');
    // 조직 기반 필터
    const [departmentFilter, setDepartmentFilter] = useState<string>('');
    const [subTeamFilter, setSubTeamFilter] = useState<string>('');
    const [userFilter, setUserFilter] = useState<string>('');
    // 기타 필터
    const [workTypeFilter, setWorkTypeFilter] = useState<string>('');

    // Load data on mount
    useEffect(() => {
        getBusinessUnits().then(setBusinessUnits);
        getDepartments().then(setDepartments);
        getUsers().then(setUsers);
    }, []);

    // Load sub-teams when department changes
    useEffect(() => {
        if (departmentFilter) {
            getSubTeams(departmentFilter).then(setSubTeams);
        } else {
            setSubTeams([]);
        }
    }, [departmentFilter]);

    // Fetch worklogs with filters
    const { data: worklogs = [], isLoading, refetch } = useWorklogsTable({
        start_date: startDate,
        end_date: endDate,
        project_id: projectFilter || undefined,
        sub_team_id: subTeamFilter || undefined,
        user_id: userFilter || undefined,
        limit: 500,
    });

    // Get all projects
    const { data: allProjects = [] } = useProjects();

    // ============ 프로젝트 기반 필터 로직 ============
    const filteredProjects = useMemo(() => {
        let result = allProjects.filter(p => !['Closed', 'Completed'].includes(p.status || ''));

        // Filter by business unit through product line
        if (businessUnitFilter) {
            result = result.filter(p =>
                p.product_line?.business_unit_id === businessUnitFilter
            );
        }
        return result;
    }, [allProjects, businessUnitFilter]);

    // ============ 조직 기반 필터 로직 ============
    const filteredUsers = useMemo(() => {
        let result = users;
        if (subTeamFilter) {
            result = result.filter(u => u.sub_team_id === subTeamFilter);
        }
        return result;
    }, [users, subTeamFilter]);

    // Work types
    const workTypes = ['SW Develop', 'Documentation', 'Meeting', 'Review', 'Training', 'Test', 'Leave', 'Support'];

    // Calculate totals
    const totalHours = worklogs.reduce((sum, wl) => sum + wl.hours, 0);

    // Quick date filters
    const setDateRange = (days: number) => {
        setEndDate(format(new Date(), 'yyyy-MM-dd'));
        setStartDate(format(subDays(new Date(), days), 'yyyy-MM-dd'));
    };

    const resetFilters = () => {
        setBusinessUnitFilter('');
        setProjectFilter('');
        setDepartmentFilter('');
        setSubTeamFilter('');
        setUserFilter('');
        setWorkTypeFilter('');
    };

    return (
        <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {!isAdmin && <span>({t('table.myLogsOnly')}) · </span>}
                    {t('table.total')}: <span className="font-bold text-primary">{totalHours.toFixed(1)}h</span>
                    {' · '}
                    {t('table.records', { count: worklogs.length })}
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="py-2">
                    <CardTitle className="text-base">{t('table.filters')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 py-2">
                    {/* Row 1: Date Range */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">{t('table.date')}:</span>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-36 h-8"
                        />
                        <span className="text-sm text-muted-foreground">~</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-36 h-8"
                        />
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setDateRange(7)}>{t('table.nDays', { count: 7 })}</Button>
                            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setDateRange(14)}>{t('table.nDays', { count: 14 })}</Button>
                            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setDateRange(30)}>{t('table.nDays', { count: 30 })}</Button>
                        </div>
                    </div>

                    {/* Row 2: 프로젝트 기반 필터 - BusinessUnit → Product Line → Project */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">{t('table.project')}:</span>
                        <select
                            className="px-2 py-1 border rounded-md text-sm h-8"
                            value={businessUnitFilter}
                            onChange={(e) => {
                                setBusinessUnitFilter(e.target.value);
                                setProjectFilter('');
                            }}
                        >
                            <option value="">{t('table.allBusinessAreas')}</option>
                            {businessUnits.map(bu => (
                                <option key={bu.id} value={bu.id}>{bu.name}</option>
                            ))}
                        </select>
                        <select
                            className="px-2 py-1 border rounded-md text-sm h-8 min-w-[200px]"
                            value={projectFilter}
                            onChange={(e) => setProjectFilter(e.target.value)}
                        >
                            <option value="">{t('table.allProjects')}</option>
                            {filteredProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.internal_io?.io_number || p.id.slice(0, 8)} - {p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Row 3: 조직 기반 필터 (Admin Only) */}
                    {isAdmin && (
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
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
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
                                {subTeams.map(st => (
                                    <option key={st.id} value={st.id}>{st.name}</option>
                                ))}
                            </select>
                            <select
                                className="px-2 py-1 border rounded-md text-sm h-8 min-w-[150px]"
                                value={userFilter}
                                onChange={(e) => setUserFilter(e.target.value)}
                            >
                                <option value="">{t('table.allUsers')}</option>
                                {filteredUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.korean_name || u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Row 4: Work Type & Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">{t('table.type')}:</span>
                        <select
                            className="px-2 py-1 border rounded-md text-sm h-8"
                            value={workTypeFilter}
                            onChange={(e) => setWorkTypeFilter(e.target.value)}
                        >
                            <option value="">{t('table.allWorkTypes')}</option>
                            {workTypes.map(wt => (
                                <option key={wt} value={wt}>{wt}</option>
                            ))}
                        </select>
                        <div className="flex-1" />
                        <Button variant="outline" size="sm" className="h-8" onClick={resetFilters}>{t('table.clearAll')}</Button>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => refetch()}>{t('table.refresh')}</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="text-center py-8">{t('status.loading')}</div>
                    ) : worklogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('table.noData')}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="text-left p-2 whitespace-nowrap">{t('table.date')}</th>
                                        {isAdmin && <th className="text-left p-2 whitespace-nowrap">{t('table.user')}</th>}
                                        <th className="text-left p-2">{t('table.project')}</th>
                                        <th className="text-left p-2 whitespace-nowrap">{t('table.workType')}</th>
                                        <th className="text-right p-2 whitespace-nowrap">{t('table.hours')}</th>
                                        <th className="text-left p-2">{t('table.description')}</th>
                                        <th className="text-center p-2 whitespace-nowrap">{t('table.flags')}</th>
                                    </tr>
                                </thead>
                                <tbody className="virtualized">
                                    {worklogs.map((wl) => (
                                        <tr key={wl.id} className="border-t hover:bg-muted/30">
                                            <td className="p-2 whitespace-nowrap">{String(wl.date)}</td>
                                            {isAdmin && (
                                                <td className="p-2 whitespace-nowrap">
                                                    <div className="font-medium">{wl.user_korean_name || wl.user_name}</div>
                                                    {wl.department_name && (
                                                        <div className="text-xs text-muted-foreground">{wl.department_name}</div>
                                                    )}
                                                </td>
                                            )}
                                            <td className="p-2">
                                                <div className="truncate max-w-[250px]" title={wl.project_name || ''}>
                                                    <span className="text-muted-foreground">{wl.project_code}</span>
                                                    {' '}
                                                    {wl.project_name}
                                                </div>
                                            </td>
                                            <td className="p-2 whitespace-nowrap">{wl.work_type_category?.name || 'N/A'}</td>
                                            <td className="p-2 text-right font-medium">{wl.hours}h</td>
                                            <td className="p-2">
                                                <div className="truncate max-w-[350px]" title={wl.description || ''}>
                                                    {wl.description || '-'}
                                                </div>
                                            </td>
                                            <td className="p-2 text-center whitespace-nowrap">
                                                {wl.is_sudden_work && <span title={t('table.suddenWork')}>⚡</span>}
                                                {wl.is_business_trip && <span title={t('table.businessTrip')}>✈️</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-muted/50 font-medium">
                                    <tr>
                                        <td colSpan={isAdmin ? 4 : 3} className="p-2 text-right">{t('table.total')}:</td>
                                        <td className="p-2 text-right">{totalHours.toFixed(1)}h</td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default WorkLogTableView;
