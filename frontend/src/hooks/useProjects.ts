import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Project, ProjectCreate, ProjectUpdate } from '@/types';

async function fetchProjects(): Promise<Project[]> {
  const { data } = await apiClient.get('/projects');
  return data;
}

async function createProject(newProject: ProjectCreate): Promise<Project> {
  const { data } = await apiClient.post('/projects', newProject);
  return data;
}

async function updateProject({ id, updatedProject }: { id: string; updatedProject: ProjectUpdate }): Promise<Project> {
  const { data } = await apiClient.put(`/projects/${id}`, updatedProject);
  return data;
}

async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`);
}


export function useProjects() {
  return useQuery<Project[], Error>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation<Project, Error, ProjectCreate>({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation<Project, Error, { id: string; updatedProject: ProjectUpdate }>({
    mutationFn: updateProject,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', data.id] }); // Invalidate single project query as well
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
