import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Project, ProjectUpdate } from '@/types';
import { useUpdateProject } from '@/hooks/useProjects';

interface ProjectUpdateFormProps {
  project: Project;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ProjectUpdateForm: React.FC<ProjectUpdateFormProps> = ({ project, onSuccess, onCancel }) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProjectUpdate>();
  const { mutate, isLoading, isError, error } = useUpdateProject();

  useEffect(() => {
    // Pre-fill form with existing project data
    reset({
      program_id: project.program_id,
      project_type_id: project.project_type_id,
      code: project.code,
      name: project.name,
      status: project.status,
      complexity: project.complexity,
      pm_id: project.pm_id,
      start_date: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '',
      end_date: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '',
      customer: project.customer,
      product: project.product,
      description: project.description,
    });
  }, [project, reset]);

  const onSubmit = (data: ProjectUpdate) => {
    mutate({ id: project.id, updatedProject: data }, {
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
        <Input id="status" {...register('status', { required: 'Status is required' })} />
        {errors.status && <p className="text-red-500 text-sm">{errors.status.message}</p>}
      </div>
      <div>
        <Label htmlFor="complexity">Complexity</Label>
        <Input id="complexity" {...register('complexity')} />
      </div>
      <div>
        <Label htmlFor="customer">Customer</Label>
        <Input id="customer" {...register('customer')} />
      </div>
      <div>
        <Label htmlFor="product">Product</Label>
        <Input id="product" {...register('product')} />
      </div>
      <div>
        <Label htmlFor="pm_id">Project Manager ID</Label>
        <Input id="pm_id" {...register('pm_id')} />
      </div>
      <div>
        <Label htmlFor="start_date">Start Date</Label>
        <Input id="start_date" type="date" {...register('start_date')} />
      </div>
      <div>
        <Label htmlFor="end_date">End Date</Label>
        <Input id="end_date" type="date" {...register('end_date')} />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Input id="description" {...register('description')} />
      </div>

      {isError && <p className="text-red-500 text-sm">Error: {error?.message}</p>}

      <div className="flex justify-end space-x-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Updating...' : 'Update Project'}
        </Button>
      </div>
    </form>
  );
};

export default ProjectUpdateForm;
