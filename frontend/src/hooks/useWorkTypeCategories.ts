import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

// Types for work type categories
export interface WorkTypeCategory {
    id: number;
    code: string;
    name: string;
    name_ko?: string;
    level: number;
    applicable_roles?: string;
    children: WorkTypeCategory[];
}

// Fetch work type categories tree
export const useWorkTypeCategories = () => {
    return useQuery({
        queryKey: ['workTypeCategories', 'tree'],
        queryFn: async () => {
            const response = await apiClient.get<WorkTypeCategory[]>('/work-types/tree');
            return response.data;
        },
        staleTime: 1000 * 60 * 30, // Cache for 30 minutes (rarely changes)
    });
};

// Fetch flat list of categories
export const useWorkTypeCategoriesFlat = (level?: number) => {
    return useQuery({
        queryKey: ['workTypeCategories', 'flat', level],
        queryFn: async () => {
            const params = level ? `?level=${level}` : '';
            const response = await apiClient.get<WorkTypeCategory[]>(`/work-types/${params}`);
            return response.data;
        },
        staleTime: 1000 * 60 * 30,
    });
};
