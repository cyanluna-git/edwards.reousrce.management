import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Project } from '@/types';

async function fetchProjectById(id: string): Promise<Project> {
  const { data } = await apiClient.get(`/projects/${id}`);
  return data;
}

export function useProject(id: string) {
  return useQuery<Project, Error>({
    queryKey: ['project', id],
    queryFn: () => fetchProjectById(id),
    enabled: !!id, // Only run the query if id is available
  });
}
