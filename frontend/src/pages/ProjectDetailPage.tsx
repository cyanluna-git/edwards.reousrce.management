import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '@/hooks/useProject';
import { useDeleteProject } from '@/hooks/useProjects'; // Import useDeleteProject
import { Card, CardContent, CardHeader, CardTitle, Button, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui';
import ProjectUpdateForm from '@/components/forms/ProjectUpdateForm'; // Import ProjectUpdateForm

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading, isError, error } = useProject(id || '');
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleDelete = () => {
    if (id) {
      deleteProject(id, {
        onSuccess: () => {
          navigate('/projects'); // Navigate back to list after deletion
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <p>Loading project details...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-red-500">Error loading project: {error?.message}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto p-4">
        <p>Project not found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">{project.name} ({project.code})</CardTitle>
          <div className="flex space-x-2">
            <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Edit</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Project</DialogTitle>
                </DialogHeader>
                <ProjectUpdateForm
                  project={project}
                  onSuccess={() => setIsUpdateModalOpen(false)}
                  onCancel={() => setIsUpdateModalOpen(false)}
                />
              </DialogContent>
            </Dialog>

            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">Delete</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Deletion</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete project "{project.name}"? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Program:</p>
              <p>{project.program?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="font-semibold">Project Type:</p>
              <p>{project.project_type?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="font-semibold">Status:</p>
              <p>{project.status}</p>
            </div>
            <div>
              <p className="font-semibold">Complexity:</p>
              <p>{project.complexity || 'N/A'}</p>
            </div>
            <div>
              <p className="font-semibold">Customer:</p>
              <p>{project.customer || 'N/A'}</p>
            </div>
            <div>
              <p className="font-semibold">Product:</p>
              <p>{project.product || 'N/A'}</p>
            </div>
            {project.pm && (
              <div>
                <p className="font-semibold">Project Manager:</p>
                <p>{project.pm.name || project.pm.email}</p>
              </div>
            )}
            <div className="col-span-2">
              <p className="font-semibold">Description:</p>
              <p>{project.description || 'No description provided.'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


