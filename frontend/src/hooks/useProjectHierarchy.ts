/**
 * Hook for fetching project and product line hierarchy for WorkLog entry
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';



// Types for hierarchy response
export interface HierarchyNode {
    id: string;
    code: string;
    name: string;
    type: 'business_unit' | 'product_line' | 'project' | 'department';
    status?: string;
    line_category?: string;
    children?: HierarchyNode[];
}

export interface ProjectHierarchyResponse {
    product_projects: HierarchyNode[];
    functional_projects: HierarchyNode[];
}

/**
 * Fetch project hierarchy for WorkLog entry
 * Returns: Business Unit -> Product Line -> Projects tree
 */
export function useProjectHierarchy(userDepartmentId?: string) {
    return useQuery<ProjectHierarchyResponse>({
        queryKey: ['project-hierarchy', userDepartmentId],
        queryFn: async () => {
            const params = userDepartmentId ? { user_department_id: userDepartmentId } : {};
            const response = await apiClient.get('/projects/hierarchy', { params });
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}


/**
 * Fetch product line hierarchy for direct product support selection
 * Returns: Business Unit -> Product Lines tree
 */
export function useProductLineHierarchy() {
    return useQuery<HierarchyNode[]>({
        queryKey: ['product-line-hierarchy'],
        queryFn: async () => {
            const response = await apiClient.get('/projects/product-lines/hierarchy');
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}


export default useProjectHierarchy;
