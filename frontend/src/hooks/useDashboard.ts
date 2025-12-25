/**
 * Hook for Dashboard data
 */
import { useQuery } from '@tanstack/react-query';
import {
    getMyDashboard,
    DashboardData,
    getTeamDashboard,
    TeamDashboardData,
    TeamDashboardScope,
    DashboardViewMode,
} from '@/api/client';

export function useDashboard() {
    return useQuery<DashboardData, Error>({
        queryKey: ['dashboard', 'my-summary'],
        queryFn: getMyDashboard,
    });
}

export function useTeamDashboard(
    scope: TeamDashboardScope = 'department',
    viewMode: DashboardViewMode = 'weekly',
    enabled: boolean = true
) {
    return useQuery<TeamDashboardData, Error>({
        queryKey: ['dashboard', 'team-summary', scope, viewMode],
        queryFn: () => getTeamDashboard(scope, viewMode),
        enabled,
    });
}

