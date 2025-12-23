import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProjectCreate, ProjectStatus, ProjectScale } from '@/types';
import { useCreateProject } from '@/hooks/useProjects';
import { getPrograms, getProjectTypes, getProductLines, getUsers } from '@/api/client';

interface ProjectCreateFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'Prospective', label: 'Prospective (잠재적)' },
  { value: 'Planned', label: 'Planned (계획됨)' },
  { value: 'InProgress', label: 'In Progress (진행중)' },
  { value: 'OnHold', label: 'On Hold (보류)' },
  { value: 'Cancelled', label: 'Cancelled (취소)' },
  { value: 'Completed', label: 'Completed (완료)' },
];

const SCALE_OPTIONS: { value: ProjectScale; label: string }[] = [
  { value: 'CIP', label: 'CIP' },
  { value: 'A&D', label: 'A&D' },
  { value: 'Simple', label: 'Simple' },
  { value: 'Complex', label: 'Complex' },
  { value: 'Platform', label: 'Platform' },
];

const ProjectCreateForm: React.FC<ProjectCreateFormProps> = ({ onSuccess, onCancel }) => {
  const { register, handleSubmit, control, formState: { errors } } = useForm<ProjectCreate>({
    defaultValues: {
      status: 'Prospective',
    }
  });
  const { mutate, isPending, isError, error } = useCreateProject();

  // Fetch meta data
  const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: getPrograms });
  const { data: projectTypes } = useQuery({ queryKey: ['projectTypes'], queryFn: getProjectTypes });
  const { data: productLines } = useQuery({ queryKey: ['productLines'], queryFn: getProductLines });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() });

  // Filter users with PM position (position_id is the source of truth for job titles)
  const pmUsers = users?.filter(u => u.position_id === 'JP_PM') || [];

  const onSubmit = (data: ProjectCreate) => {
    mutate(data, {
      onSuccess: () => {
        onSuccess?.();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {/* Project Code */}
      <div>
        <Label htmlFor="code">Project Code</Label>
        <Input id="code" {...register('code', { required: 'Project Code is required' })} />
        {errors.code && <p className="text-red-500 text-sm">{errors.code.message}</p>}
      </div>

      {/* Project Name */}
      <div>
        <Label htmlFor="name">Project Name</Label>
        <Input id="name" {...register('name', { required: 'Project Name is required' })} />
        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
      </div>

      {/* Program */}
      <div>
        <Label htmlFor="program_id">Program</Label>
        <Controller
          name="program_id"
          control={control}
          rules={{ required: 'Program is required' }}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select Program" />
              </SelectTrigger>
              <SelectContent>
                {programs?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.program_id && <p className="text-red-500 text-sm">{errors.program_id.message}</p>}
      </div>

      {/* Project Type */}
      <div>
        <Label htmlFor="project_type_id">Project Type</Label>
        <Controller
          name="project_type_id"
          control={control}
          rules={{ required: 'Project Type is required' }}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select Project Type" />
              </SelectTrigger>
              <SelectContent>
                {projectTypes?.map((pt) => (
                  <SelectItem key={pt.id} value={pt.id}>
                    {pt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.project_type_id && <p className="text-red-500 text-sm">{errors.project_type_id.message}</p>}
      </div>

      {/* Status */}
      <div>
        <Label htmlFor="status">Status</Label>
        <Controller
          name="status"
          control={control}
          rules={{ required: 'Status is required' }}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || 'Prospective'}>
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.status && <p className="text-red-500 text-sm">{errors.status.message}</p>}
      </div>

      {/* Scale */}
      <div>
        <Label htmlFor="scale">Scale</Label>
        <Controller
          name="scale"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select Scale" />
              </SelectTrigger>
              <SelectContent>
                {SCALE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Product Line */}
      <div>
        <Label htmlFor="product_line_id">Product Line</Label>
        <Controller
          name="product_line_id"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select Product Line" />
              </SelectTrigger>
              <SelectContent>
                {productLines?.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id}>
                    {pl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Project Manager */}
      <div>
        <Label htmlFor="pm_id">Project Manager</Label>
        <Controller
          name="pm_id"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select PM" />
              </SelectTrigger>
              <SelectContent>
                {pmUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.korean_name || u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Customer */}
      <div>
        <Label htmlFor="customer">Customer</Label>
        <Input id="customer" {...register('customer')} />
      </div>

      {/* Product */}
      <div>
        <Label htmlFor="product">Product</Label>
        <Input id="product" {...register('product')} />
      </div>

      {/* Start Month */}
      <div>
        <Label htmlFor="start_month">Start Month (YYYY-MM)</Label>
        <Input
          id="start_month"
          type="month"
          {...register('start_month')}
        />
      </div>

      {/* End Month */}
      <div>
        <Label htmlFor="end_month">End Month (YYYY-MM)</Label>
        <Input
          id="end_month"
          type="month"
          {...register('end_month')}
        />
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description</Label>
        <Input id="description" {...register('description')} />
      </div>

      {isError && <p className="text-red-500 text-sm">Error: {error?.message}</p>}

      <div className="flex justify-end space-x-2 pt-4 sticky bottom-0 bg-white">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
};

export default ProjectCreateForm;
