import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';
import ProjectCreateForm from '@/components/forms/ProjectCreateForm';

// Status priority for sorting (lower = higher priority)
// const STATUS_PRIORITY: Record<string, number> = {
//   'InProgress': 1,
//   'Planned': 2,
//   'Prospective': 3,
//   'OnHold': 4,
//   'Completed': 5,
//   'Closed': 6,
//   'Cancelled': 7,
// };

// Status color mapping
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'InProgress': { bg: 'bg-green-100', text: 'text-green-800' },
  'Planned': { bg: 'bg-blue-100', text: 'text-blue-800' },
  'Prospective': { bg: 'bg-purple-100', text: 'text-purple-800' },
  'OnHold': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  'Completed': { bg: 'bg-gray-100', text: 'text-gray-600' },
  'Closed': { bg: 'bg-gray-200', text: 'text-gray-500' },
  'Cancelled': { bg: 'bg-red-100', text: 'text-red-800' },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {status}
    </span>
  );
}

export function ProjectsPage() {
  // Always sort by activity for now as per user request
  const { data: projects, isLoading, error } = useProjects('activity');
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Sorting logic now handled by backend mostly but we might want to keep client-side sort as fallback or refinement
  // If backend returns sorted by activity, we can just use that.
  // However, the existing code sorts by "Status Priority".
  // The user said: "Sort in order of active projects".
  // Let's use the backend sorting primary, but maybe keep status grouping if desired? 
  // User prompt: "Prioritize getting activity and sort by active project order" implies this should overlap status sort.
  // I will use the backend results directly if available.

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    // If backend already sorted by activity, just return it.
    // Or we can add a secondary sort here if needed.
    return projects;
  }, [projects]);

  if (isLoading) {
    return <div className="p-4">Loading projects...</div>;
  }

  if (error) {
    return <div className="p-4">Error loading projects: {error.message}</div>;
  }

  return (
    <Card className="m-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Projects ({sortedProjects.length})</CardTitle>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>Create Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <ProjectCreateForm onSuccess={() => setIsCreateModalOpen(false)} onCancel={() => setIsCreateModalOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business Area</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Activity (30d)</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Product Line</TableHead>
              <TableHead>Scale</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>PM</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.map((project) => (
              <TableRow
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="cursor-pointer"
              >
                <TableCell className="whitespace-nowrap">
                  {project.program?.business_unit?.name ?? '-'}
                </TableCell>
                <TableCell>
                  <StatusBadge status={project.status || 'Unknown'} />
                </TableCell>
                <TableCell>
                  {project.recent_activity_score ? (
                    <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                      {project.recent_activity_score.toFixed(0)}h
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{project.code}</TableCell>
                <TableCell>{project.name}</TableCell>
                <TableCell>{project.program?.name ?? 'N/A'}</TableCell>
                <TableCell>{project.product_line?.name ?? '-'}</TableCell>
                <TableCell>{project.scale ?? '-'}</TableCell>
                <TableCell>{project.customer ?? '-'}</TableCell>
                <TableCell>{project.pm?.name ?? 'N/A'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
