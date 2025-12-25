/**
 * Hook for fetching users
 */
import { useQuery } from '@tanstack/react-query';
import { getUsers, UserDetails } from '@/api/client';

export function useUsers(departmentId?: string, isActive?: boolean) {
    return useQuery<UserDetails[], Error>({
        queryKey: ['users', departmentId, isActive],
        queryFn: () => getUsers(departmentId, isActive),
    });
}
