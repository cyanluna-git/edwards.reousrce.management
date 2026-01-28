import React from 'react';
import { useProjectDashboard } from '@/hooks/useProject';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import {
  Target,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Calendar,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

interface ProjectDashboardProps {
  projectId: string;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ projectId }) => {
  const { data, isLoading, error } = useProjectDashboard(projectId);

  if (isLoading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-red-500">
        Failed to load project dashboard.
      </div>
    );
  }

  const { project, milestone_stats, resource_summary, worklog_trends, team_members } = data;

  // Calculate total hours from team members
  const totalTeamHours = team_members.reduce((sum, m) => sum + m.total_hours, 0);

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <CardContent className="py-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-100 text-sm">
                {project.business_unit} {project.product_line && `> ${project.product_line}`}
              </p>
              <h2 className="text-2xl font-bold mt-1">{project.name}</h2>
              <p className="text-blue-100 text-sm mt-1">
                {project.code} | {project.category === 'PRODUCT' ? 'Product Project' : 'Functional Project'}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  project.status === 'InProgress'
                    ? 'bg-green-500'
                    : project.status === 'Completed'
                    ? 'bg-gray-500'
                    : project.status === 'OnHold'
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
                }`}
              >
                {project.status}
              </span>
              {project.pm && (
                <p className="text-blue-100 text-sm mt-2">
                  PM: {project.pm.korean_name || project.pm.name}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Milestones</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold">{milestone_stats.total}</span>
              <span className="text-sm text-muted-foreground ml-1">total</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-green-600">
                {milestone_stats.completion_rate}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <span className="text-sm text-muted-foreground">Team Members</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold">{team_members.length}</span>
              <span className="text-sm text-muted-foreground ml-1">active</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-500" />
              <span className="text-sm text-muted-foreground">Total Hours</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold">{totalTeamHours.toFixed(0)}</span>
              <span className="text-sm text-muted-foreground ml-1">h (90d)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestone Progress & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Milestone Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Milestone Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Completion</span>
                <span className="font-medium">{milestone_stats.completion_rate}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${(milestone_stats.completed / Math.max(milestone_stats.total, 1)) * 100}%` }}
                />
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${(milestone_stats.delayed / Math.max(milestone_stats.total, 1)) * 100}%` }}
                />
                <div
                  className="bg-amber-400 h-full"
                  style={{ width: `${(milestone_stats.pending / Math.max(milestone_stats.total, 1)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Completed ({milestone_stats.completed})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Delayed ({milestone_stats.delayed})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Pending ({milestone_stats.pending})
                </span>
              </div>
            </div>

            {/* Overdue Milestones */}
            {milestone_stats.overdue.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="text-sm font-medium text-red-700 flex items-center gap-1 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  Overdue ({milestone_stats.overdue.length})
                </h4>
                <div className="space-y-1">
                  {milestone_stats.overdue.slice(0, 3).map((m) => (
                    <div key={m.id} className="flex justify-between text-sm">
                      <span className="text-red-700">
                        {m.name}
                        {m.is_key_gate && <span className="text-xs ml-1">(Key)</span>}
                      </span>
                      <span className="text-red-600 font-medium">+{m.days_overdue}d</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Milestones */}
            {milestone_stats.upcoming.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="text-sm font-medium text-amber-700 flex items-center gap-1 mb-2">
                  <Clock className="w-4 h-4" />
                  Upcoming ({milestone_stats.upcoming.length})
                </h4>
                <div className="space-y-1">
                  {milestone_stats.upcoming.slice(0, 3).map((m) => (
                    <div key={m.id} className="flex justify-between text-sm">
                      <span className="text-amber-700">
                        {m.name}
                        {m.is_key_gate && <span className="text-xs ml-1">(Key)</span>}
                      </span>
                      <span className="text-amber-600 font-medium">D-{m.days_until}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resource Allocation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Resource Allocation (Next 4 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resource_summary.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No resource plans</div>
            ) : (
              <div className="space-y-3">
                {resource_summary.map((rs) => (
                  <div key={rs.month}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{rs.month}</span>
                      <span className="text-muted-foreground">
                        {rs.total_hours.toFixed(0)}h ({rs.assigned_count + rs.tbd_count} people)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className="bg-blue-500 h-full"
                        style={{
                          width: `${(rs.assigned_count / Math.max(rs.assigned_count + rs.tbd_count, 1)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-amber-400 h-full"
                        style={{
                          width: `${(rs.tbd_count / Math.max(rs.assigned_count + rs.tbd_count, 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                      <span>Assigned: {rs.assigned_count}</span>
                      {rs.tbd_count > 0 && (
                        <span className="text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          TBD: {rs.tbd_count}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Worklog Trends & Team Members */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Worklog Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Weekly Activity (Last 4 Weeks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {worklog_trends.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No activity data</div>
            ) : (
              <div className="space-y-2">
                {worklog_trends.map((wt, index) => {
                  const maxHours = Math.max(...worklog_trends.map((w) => w.total_hours), 1);
                  return (
                    <div key={wt.week_start || index} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-muted-foreground">
                        {wt.week_start ? wt.week_start.slice(5) : '-'}
                      </div>
                      <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                        <div
                          className="bg-teal-500 h-full rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${(wt.total_hours / maxHours) * 100}%`, minWidth: '20px' }}
                        >
                          {wt.total_hours >= 10 && (
                            <span className="text-[10px] text-white font-medium">
                              {wt.total_hours.toFixed(0)}h
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm">
                        <span className="font-medium">{wt.total_hours.toFixed(0)}h</span>
                      </div>
                      <div className="w-12 text-right text-xs text-muted-foreground">
                        {wt.unique_users}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Top Contributors (Last 90 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {team_members.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No team activity</div>
            ) : (
              <div className="space-y-2">
                {team_members.slice(0, 8).map((member) => {
                  const percentage = totalTeamHours > 0
                    ? Math.round((member.total_hours / totalTeamHours) * 100)
                    : 0;
                  return (
                    <div key={member.user_id} className="flex items-center gap-3">
                      <div className="w-24 truncate text-sm">
                        <span className="font-medium">{member.korean_name || member.name}</span>
                      </div>
                      <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-14 text-right text-sm font-medium">
                        {member.total_hours.toFixed(0)}h
                      </div>
                      <div className="w-10 text-right">
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectDashboard;
