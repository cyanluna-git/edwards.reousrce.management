/**
 * Hook for Dashboard data
 */
import { useQuery } from '@tanstack/react-query';
import { getMyDashboard, DashboardData } from '@/api/client';

export function useDashboard() {
    return useQuery<DashboardData, Error>({
        queryKey: ['dashboard', 'my-summary'],
        queryFn: getMyDashboard,
    });
}
