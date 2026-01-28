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

import type { WorklogStats } from '@/types';

async function fetchProjectWorklogStats(id: string): Promise<WorklogStats[]> {
  const { data } = await apiClient.get(`/projects/${id}/stats`);
  return data;
}

export function useProjectWorklogStats(id: string) {
  return useQuery<WorklogStats[], Error>({
    queryKey: ['project-worklog-stats', id],
    queryFn: () => fetchProjectWorklogStats(id),
    enabled: !!id,
  });
}

// ============ Project Dashboard ============

export interface ProjectDashboardData {
  project: {
    id: string;
    code: string;
    name: string;
    status: string;
    category: string;
    scale: string | null;
    customer: string | null;
    product: string | null;
    start_month: string | null;
    end_month: string | null;
    pm: {
      id: string;
      name: string;
      korean_name: string | null;
    } | null;
    business_unit: string | null;
    product_line: string | null;
  };
  milestone_stats: {
    total: number;
    completed: number;
    delayed: number;
    pending: number;
    completion_rate: number;
    upcoming: Array<{
      id: number;
      name: string;
      target_date: string;
      days_until: number;
      is_key_gate: boolean;
    }>;
    overdue: Array<{
      id: number;
      name: string;
      target_date: string;
      days_overdue: number;
      is_key_gate: boolean;
    }>;
  };
  resource_summary: Array<{
    month: string;
    total_hours: number;
    assigned_count: number;
    tbd_count: number;
  }>;
  worklog_trends: Array<{
    week_start: string;
    total_hours: number;
    unique_users: number;
  }>;
  team_members: Array<{
    user_id: string;
    name: string;
    korean_name: string | null;
    total_hours: number;
  }>;
}

async function fetchProjectDashboard(id: string): Promise<ProjectDashboardData> {
  const { data } = await apiClient.get(`/projects/${id}/dashboard`);
  return data;
}

export function useProjectDashboard(id: string) {
  return useQuery<ProjectDashboardData, Error>({
    queryKey: ['project-dashboard', id],
    queryFn: () => fetchProjectDashboard(id),
    enabled: !!id,
  });
}
