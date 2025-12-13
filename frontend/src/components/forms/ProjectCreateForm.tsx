import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Assuming a Label component exists or create one
import { ProjectCreate } from '@/types';
import { useCreateProject } from '@/hooks/useProjects';

interface ProjectCreateFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ProjectCreateForm: React.FC<ProjectCreateFormProps> = ({ onSuccess, onCancel }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<ProjectCreate>();
  const { mutate, isPending, isError, error } = useCreateProject();

  const onSubmit = (data: ProjectCreate) => {
    mutate(data, {
      onSuccess: () => {
        onSuccess?.();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="code">Project Code</Label>
        <Input id="code" {...register('code', { required: 'Project Code is required' })} />
        {errors.code && <p className="text-red-500 text-sm">{errors.code.message}</p>}
      </div>
      <div>
        <Label htmlFor="name">Project Name</Label>
        <Input id="name" {...register('name', { required: 'Project Name is required' })} />
        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
      </div>
      <div>
        <Label htmlFor="program_id">Program ID</Label>
        <Input id="program_id" {...register('program_id', { required: 'Program ID is required' })} />
        {errors.program_id && <p className="text-red-500 text-sm">{errors.program_id.message}</p>}
      </div>
      <div>
        <Label htmlFor="project_type_id">Project Type ID</Label>
        <Input id="project_type_id" {...register('project_type_id', { required: 'Project Type ID is required' })} />
        {errors.project_type_id && <p className="text-red-500 text-sm">{errors.project_type_id.message}</p>}
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Input id="status" defaultValue="WIP" {...register('status', { required: 'Status is required' })} />
        {errors.status && <p className="text-red-500 text-sm">{errors.status.message}</p>}
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Input id="description" {...register('description')} />
      </div>

      {isError && <p className="text-red-500 text-sm">Error: {error?.message}</p>}

      <div className="flex justify-end space-x-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
};

export default ProjectCreateForm;
