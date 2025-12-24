/**
 * WorkLog Table Page
 * Table view for all work logs with filters
 * - Admin: Can see all worklogs
 * - User: Can only see their own worklogs
 * 
 * Filter Logic:
 * - 사업영역(BusinessUnit) → Program → Project 기준으로 필터 (프로젝트 종속)
 * - 조직(Department/SubTeam/User) 기준은 별도로 필터 (인력 종속)
 */
import { useState, useMemo, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorklogsTable } from '@/hooks/useWorklogs';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { getBusinessUnits, getDepartments, getSubTeams, getUsers, getPrograms, BusinessUnit, Department, SubTeam, UserDetails } from '@/api/client';
import type { Program } from '@/types';

export function WorkLogTablePage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';

    // Data for filters
    const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
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
    const [programFilter, setProgramFilter] = useState<string>('');
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
        getPrograms().then(setPrograms);
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
        department_id: departmentFilter || undefined,
        user_id: userFilter || undefined,
        work_type: workTypeFilter || undefined,
        limit: 500,
    });

    // Get all projects
    const { data: allProjects = [] } = useProjects();

    // ============ 프로젝트 기반 필터 로직 ============
    // 1. Programs filtered by BusinessUnit
    const filteredPrograms = useMemo(() =>
        businessUnitFilter
            ? programs.filter(p => p.business_unit_id === businessUnitFilter)
            : programs,
        [programs, businessUnitFilter]
    );

    // 2. Projects filtered by Program and BusinessUnit, excluding Closed/Completed
    const filteredProjects = useMemo(() => {
        let result = allProjects.filter(p => !['Closed', 'Completed'].includes(p.status || ''));

        if (programFilter) {
            result = result.filter(p => p.program_id === programFilter);
        } else if (businessUnitFilter) {
            // Filter by BusinessUnit via Program
            const programIds = filteredPrograms.map(prg => prg.id);
            result = result.filter(p => programIds.includes(p.program_id || ''));
        }
        return result;
    }, [allProjects, programFilter, businessUnitFilter, filteredPrograms]);

    // ============ 조직 기반 필터 로직 ============
    // Users filtered by department/subteam
    const filteredUsers = useMemo(() => {
        let result = users;
        if (departmentFilter) {
            result = result.filter(u => u.department_id === departmentFilter);
        }
        if (subTeamFilter) {
            result = result.filter(u => u.sub_team_id === subTeamFilter);
        }
        return result;
    }, [users, departmentFilter, subTeamFilter]);

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
        setProgramFilter('');
        setProjectFilter('');
        setDepartmentFilter('');
        setSubTeamFilter('');
        setUserFilter('');
        setWorkTypeFilter('');
    };

    return (
        <div className="w-full px-2 py-2 space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">
                    📊 WorkLog Table
                    {!isAdmin && <span className="text-sm font-normal text-muted-foreground ml-2">(My Logs Only)</span>}
                </h1>
                <div className="text-sm text-muted-foreground">
                    Total: <span className="font-bold text-primary">{totalHours.toFixed(1)}h</span>
                    {' · '}
                    {worklogs.length} records
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="py-2">
                    <CardTitle className="text-base">Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 py-2">
                    {/* Row 1: Date Range */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">Date:</span>
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
                            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setDateRange(7)}>7일</Button>
                            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setDateRange(14)}>14일</Button>
                            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setDateRange(30)}>30일</Button>
                        </div>
                    </div>

                    {/* Row 2: 프로젝트 기반 필터 - BusinessUnit → Program → Project */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">Project:</span>
                        <select
                            className="px-2 py-1 border rounded-md text-sm h-8"
                            value={businessUnitFilter}
                            onChange={(e) => {
                                setBusinessUnitFilter(e.target.value);
                                setProgramFilter('');
                                setProjectFilter('');
                            }}
                        >
                            <option value="">All Business Areas</option>
                            {businessUnits.map(bu => (
                                <option key={bu.id} value={bu.id}>{bu.name}</option>
                            ))}
                        </select>
                        <select
                            className="px-2 py-1 border rounded-md text-sm h-8"
                            value={programFilter}
                            onChange={(e) => {
                                setProgramFilter(e.target.value);
                                setProjectFilter('');
                            }}
                        >
                            <option value="">All Programs</option>
                            {filteredPrograms.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <select
                            className="px-2 py-1 border rounded-md text-sm h-8 min-w-[200px]"
                            value={projectFilter}
                            onChange={(e) => setProjectFilter(e.target.value)}
                        >
                            <option value="">All Projects</option>
                            {filteredProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Row 3: 조직 기반 필터 (Admin Only) - Department → SubTeam → User */}
                    {isAdmin && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground w-16">Org:</span>
                            <select
                                className="px-2 py-1 border rounded-md text-sm h-8"
                                value={departmentFilter}
                                onChange={(e) => {
                                    setDepartmentFilter(e.target.value);
                                    setSubTeamFilter('');
                                    setUserFilter('');
                                }}
                            >
                                <option value="">All Departments</option>
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
                                <option value="">All Sub-Teams</option>
                                {subTeams.map(st => (
                                    <option key={st.id} value={st.id}>{st.name}</option>
                                ))}
                            </select>
                            <select
                                className="px-2 py-1 border rounded-md text-sm h-8 min-w-[150px]"
                                value={userFilter}
                                onChange={(e) => setUserFilter(e.target.value)}
                            >
                                <option value="">All Users</option>
                                {filteredUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.korean_name || u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Row 4: Work Type & Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16">Type:</span>
                        <select
                            className="px-2 py-1 border rounded-md text-sm h-8"
                            value={workTypeFilter}
                            onChange={(e) => setWorkTypeFilter(e.target.value)}
                        >
                            <option value="">All Work Types</option>
                            {workTypes.map(wt => (
                                <option key={wt} value={wt}>{wt}</option>
                            ))}
                        </select>
                        <div className="flex-1" />
                        <Button variant="outline" size="sm" className="h-8" onClick={resetFilters}>Clear All</Button>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => refetch()}>🔄 Refresh</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="text-center py-8">Loading worklogs...</div>
                    ) : worklogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No worklogs found</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="text-left p-2 whitespace-nowrap">Date</th>
                                        {isAdmin && <th className="text-left p-2 whitespace-nowrap">User</th>}
                                        <th className="text-left p-2">Project</th>
                                        <th className="text-left p-2 whitespace-nowrap">Work Type</th>
                                        <th className="text-right p-2 whitespace-nowrap">Hours</th>
                                        <th className="text-left p-2">Description</th>
                                        <th className="text-center p-2 whitespace-nowrap">Flags</th>
                                    </tr>
                                </thead>
                                <tbody>
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
                                            <td className="p-2 whitespace-nowrap">{wl.work_type}</td>
                                            <td className="p-2 text-right font-medium">{wl.hours}h</td>
                                            <td className="p-2">
                                                <div className="truncate max-w-[350px]" title={wl.description || ''}>
                                                    {wl.description || '-'}
                                                </div>
                                            </td>
                                            <td className="p-2 text-center whitespace-nowrap">
                                                {wl.is_sudden_work && <span title="Sudden Work">⚡</span>}
                                                {wl.is_business_trip && <span title="Business Trip">✈️</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-muted/50 font-medium">
                                    <tr>
                                        <td colSpan={isAdmin ? 4 : 3} className="p-2 text-right">Total:</td>
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

export default WorkLogTablePage;
