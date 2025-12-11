import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Project } from '@/types';

async function fetchProjects(): Promise<Project[]> {
  const { data } = await apiClient.get('/projects');
  return data;
}

export function useProjects() {
  return useQuery<Project[], Error>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
}
