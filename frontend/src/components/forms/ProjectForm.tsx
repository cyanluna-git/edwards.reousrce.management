/**
 * ProjectForm - Unified Project Create/Update Form
 * Handles both creating new projects and updating existing ones
 */
import React, { useEffect, useMemo } from 'react';
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
import { Project, ProjectCreate, ProjectUpdate, ProjectStatus, ProjectScale } from '@/types';
import { useCreateProject, useUpdateProject } from '@/hooks/useProjects';
// Note: getPrograms and getProjectTypes are hidden from UI
import { /* getPrograms, getProjectTypes, */ getProductLines, getUsers } from '@/api/client';

// ============================================================
// Constants
// ============================================================

export const STATUS_OPTIONS: { value: ProjectStatus; label: string; color: string }[] = [
    { value: 'Prospective', label: 'Prospective', color: 'bg-gray-400' },
    { value: 'Planned', label: 'Planned', color: 'bg-blue-400' },
    { value: 'InProgress', label: 'In Progress', color: 'bg-green-500' },
    { value: 'OnHold', label: 'On Hold', color: 'bg-yellow-500' },
    { value: 'Cancelled', label: 'Cancelled', color: 'bg-red-500' },
    { value: 'Completed', label: 'Completed', color: 'bg-purple-500' },
];

export const SCALE_OPTIONS: { value: ProjectScale; label: string }[] = [
    { value: 'CIP', label: 'CIP' },
    { value: 'A&D', label: 'A&D' },
    { value: 'Simple', label: 'Simple' },
    { value: 'Complex', label: 'Complex' },
    { value: 'Platform', label: 'Platform' },
];

// ============================================================
// Types
// ============================================================

type ProjectFormData = ProjectCreate | ProjectUpdate;

interface ProjectFormProps {
    /** Existing project for edit mode. If undefined, form is in create mode */
    project?: Project;
    onSuccess?: () => void;
    onCancel?: () => void;
    initialValues?: Partial<ProjectFormData>;
}

// ============================================================
// Component
// ============================================================

export const ProjectForm: React.FC<ProjectFormProps> = ({ project, onSuccess, onCancel, initialValues }) => {
    const isEditMode = !!project;

    // Build default values based on mode
    const getDefaultValues = (): Partial<ProjectFormData> => {
        if (isEditMode && project) {
            return {
                program_id: project.program_id || undefined,
                project_type_id: project.project_type_id || undefined,
                code: project.code || '',
                name: project.name || '',
                status: project.status || 'Prospective',
                scale: project.scale || undefined,
                product_line_id: project.product_line_id || undefined,
                pm_id: project.pm_id || undefined,
                start_month: project.start_month || '',
                end_month: project.end_month || '',
                customer: project.customer || '',
                product: project.product || '',
                description: project.description || '',
            };
        }
        return { status: 'Prospective', ...initialValues };
    };

    const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ProjectFormData>({
        defaultValues: getDefaultValues(),
    });


    const createMutation = useCreateProject();
    const updateMutation = useUpdateProject();
    const { mutate, isPending, isError, error } = isEditMode ? updateMutation : createMutation;

    // Fetch meta data
    // Note: programs and projectTypes are hidden from UI, commented out to avoid lint warnings
    // const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: getPrograms });
    // const { data: projectTypes } = useQuery({ queryKey: ['projectTypes'], queryFn: getProjectTypes });
    const { data: productLines } = useQuery({ queryKey: ['productLines'], queryFn: getProductLines });
    const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() });

    // Filter users with PM position
    const pmUsers = users?.filter(u => u.position_id === 'JP_PM') || [];

    // Filter product lines (Family) by the same BU as the current project
    // In edit mode, only show families from the same Business Unit
    const filteredProductLines = useMemo(() => {
        if (!productLines) return [];

        // If editing and project has a product_line with business_unit_id, filter by BU
        if (isEditMode && project?.product_line?.business_unit_id) {
            const projectBuId = project.product_line.business_unit_id;
            return productLines.filter(pl => pl.business_unit_id === projectBuId);
        }

        // In create mode or if no product_line, show all
        return productLines;
    }, [productLines, isEditMode, project?.product_line?.business_unit_id]);

    // Re-initialize form when project changes (for modal re-open scenarios)
    useEffect(() => {
        if (project) {
            reset(getDefaultValues());
        }
    }, [project?.id]); // Only reset when project ID changes

    const onSubmit = (data: ProjectFormData) => {
        if (isEditMode && project) {
            (mutate as typeof updateMutation.mutate)({ id: project.id, updatedProject: data }, {
                onSuccess: () => onSuccess?.(),
            });
        } else {
            (mutate as typeof createMutation.mutate)(data as ProjectCreate, {
                onSuccess: () => onSuccess?.(),
            });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Project Code - Only show in create mode, optional since backend can auto-generate */}
            {!isEditMode && (
                <div>
                    <Label htmlFor="code">Project Code (optional)</Label>
                    <Input id="code" {...register('code')} placeholder="Auto-generated if empty" />
                    {errors.code && <p className="text-red-500 text-sm">{errors.code.message}</p>}
                </div>
            )}

            {/* Project Name - Full width */}
            <div>
                <Label htmlFor="name">Project Name</Label>
                <Input id="name" {...register('name', { required: 'Project Name is required' })} />
                {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
            </div>


            {/* Program - Hidden: now using Product Line (Family) for grouping */}
            {/* <div>
                <Label htmlFor="program_id">Program</Label>
                <Controller
                    name="program_id"
                    control={control}
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
            </div> */}


            {/* Project Type - Hidden: Scale field covers this functionality */}
            {/* <div>
                <Label htmlFor="project_type_id">Project Type</Label>
                <Controller
                    name="project_type_id"
                    control={control}
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
            </div> */}

            {/* Row 1: Status & Scale */}
            <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <div>
                    <Label htmlFor="status">Status</Label>
                    <Controller
                        name="status"
                        control={control}
                        rules={{ required: 'Status is required' }}
                        render={({ field }) => {
                            const selectedStatus = STATUS_OPTIONS.find(opt => opt.value === field.value);
                            return (
                                <Select onValueChange={field.onChange} value={field.value || (isEditMode ? '' : 'Prospective')}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Status">
                                            {selectedStatus && (
                                                <span className="flex items-center gap-2">
                                                    <span className={`w-3 h-3 rounded-full ${selectedStatus.color}`} />
                                                    {selectedStatus.label}
                                                </span>
                                            )}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                <span className="flex items-center gap-2">
                                                    <span className={`w-3 h-3 rounded-full ${opt.color}`} />
                                                    {opt.label}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            );
                        }}
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
            </div>

            {/* Row 2: Family & Project Manager */}
            <div className="grid grid-cols-2 gap-4">
                {/* Family (formerly Product Line) */}
                <div>
                    <Label htmlFor="product_line_id">Family</Label>
                    <Controller
                        name="product_line_id"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Family" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredProductLines.map((pl) => (
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
            </div>

            {/* Row 3: Customer & Product */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="customer">Customer</Label>
                    <Input id="customer" {...register('customer')} />
                </div>
                <div>
                    <Label htmlFor="product">Product</Label>
                    <Input id="product" {...register('product')} />
                </div>
            </div>

            {/* Row 4: Start & End Month - Side by side with native date picker */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="start_month">Start Month</Label>
                    <input
                        id="start_month"
                        type="month"
                        {...register('start_month')}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        placeholder="YYYY-MM"
                    />
                </div>
                <div>
                    <Label htmlFor="end_month">End Month</Label>
                    <input
                        id="end_month"
                        type="month"
                        {...register('end_month')}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        placeholder="YYYY-MM"
                    />
                </div>
            </div>

            {/* Description - Full width textarea */}
            <div>
                <Label htmlFor="description">Description</Label>
                <textarea
                    id="description"
                    {...register('description')}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                    placeholder="Enter project description..."
                    rows={4}
                />
            </div>

            {isError && <p className="text-red-500 text-sm">Error: {error?.message}</p>}

            <div className="flex justify-end space-x-2 pt-4 sticky bottom-0 bg-white">
                {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
                <Button
                    type="submit"
                    disabled={isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {isPending
                        ? (isEditMode ? 'Updating...' : 'Creating...')
                        : (isEditMode ? 'Update Project' : 'Create Project')
                    }
                </Button>
            </div>
        </form>
    );
};

export default ProjectForm;
