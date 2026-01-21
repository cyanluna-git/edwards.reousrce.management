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
import { /* getPrograms, getProjectTypes, */ getProductLines, getUsers, getBusinessUnits, getDepartments, type Department } from '@/api/client';

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

export const CATEGORY_OPTIONS: { value: 'PRODUCT' | 'FUNCTIONAL'; label: string; color: string }[] = [
    { value: 'PRODUCT', label: 'Product Project', color: 'bg-blue-500' },
    { value: 'FUNCTIONAL', label: 'Functional Project', color: 'bg-purple-500' },
];

export const FUNDING_ENTITY_OPTIONS = [
    { value: 'ENTITY_VSS', label: 'VSS Division' },
    { value: 'ENTITY_SUN', label: 'SUN Division' },
    { value: 'ENTITY_LOCAL_KR', label: 'Local Korea' },
    { value: 'ENTITY_SHARED', label: 'Shared Services' },
];

export const RECHARGE_STATUS_OPTIONS = [
    { value: 'BILLABLE', label: 'Billable' },
    { value: 'NON_BILLABLE', label: 'Non-Billable' },
    { value: 'INTERNAL', label: 'Internal' },
];

export const IO_CATEGORY_OPTIONS = [
    { value: 'NPI', label: 'NPI (New Product Introduction)' },
    { value: 'FIELD_FAILURE', label: 'Field Failure Escalation' },
    { value: 'OPS_SUPPORT', label: 'Operations Support' },
    { value: 'SUSTAINING', label: 'Sustaining Engineering' },
    { value: 'CIP', label: 'CIP (Continuous Improvement)' },
    { value: 'OTHER', label: 'Other (Miscellaneous)' },
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
    const getDefaultValues = (): Partial<ProjectFormData & { business_unit_id?: string }> => {
        if (isEditMode && project) {
            return {
                program_id: project.program_id || undefined,
                project_type_id: project.project_type_id || undefined,
                code: project.code || '',
                name: project.name || '',
                status: project.status || 'Prospective',
                scale: project.scale || undefined,
                category: project.category || 'PRODUCT',
                product_line_id: project.product_line_id || undefined,
                business_unit_id: project.product_line?.business_unit_id || undefined,
                pm_id: project.pm_id || undefined,
                start_month: project.start_month || '',
                end_month: project.end_month || '',
                customer: project.customer || '',
                product: project.product || '',
                description: project.description || '',
                // Financial fields
                funding_entity_id: project.funding_entity_id || undefined,
                recharge_status: project.recharge_status || undefined,
                io_category_code: project.io_category_code || undefined,
                is_capitalizable: project.is_capitalizable || false,
                owner_department_id: project.owner_department_id || undefined,
            };
        }
        return { status: 'Prospective', category: 'PRODUCT', ...initialValues };
    };

    const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<ProjectFormData & { business_unit_id?: string }>({
        defaultValues: getDefaultValues(),
    });

    // Watch business_unit_id for cascading filter
    const selectedBusinessUnitId = watch('business_unit_id');
    // Watch category for conditional rendering
    const selectedCategory = watch('category');


    const createMutation = useCreateProject();
    const updateMutation = useUpdateProject();
    const { mutate, isPending, isError, error } = isEditMode ? updateMutation : createMutation;

    // Fetch meta data
    // Note: programs and projectTypes are hidden from UI, commented out to avoid lint warnings
    // const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: getPrograms });
    // const { data: projectTypes } = useQuery({ queryKey: ['projectTypes'], queryFn: getProjectTypes });
    const { data: businessUnits } = useQuery({ queryKey: ['businessUnits'], queryFn: getBusinessUnits });
    const { data: productLines } = useQuery({ queryKey: ['productLines'], queryFn: getProductLines });
    const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() });
    const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => getDepartments() });

    // Filter users with PM position
    const pmUsers = users?.filter(u => u.position_id === 'JP_PM') || [];

    // Filter product lines (Family) by selected Business Unit
    const filteredProductLines = useMemo(() => {
        if (!productLines) return [];

        // Filter by selected business unit
        if (selectedBusinessUnitId) {
            return productLines.filter(pl => pl.business_unit_id === selectedBusinessUnitId);
        }

        // If no business unit selected, show all
        return productLines;
    }, [productLines, selectedBusinessUnitId]);

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

            {/* Row 1: Category & Status */}
            <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                    <Label htmlFor="category">Project Category</Label>
                    <Controller
                        name="category"
                        control={control}
                        render={({ field }) => {
                            const selectedCat = CATEGORY_OPTIONS.find(opt => opt.value === field.value);
                            return (
                                <Select
                                    onValueChange={(value) => {
                                        field.onChange(value);
                                        // Clear Business Unit and Family when switching to FUNCTIONAL
                                        if (value === 'FUNCTIONAL') {
                                            setValue('business_unit_id', '');
                                            setValue('product_line_id', '');
                                        }
                                    }}
                                    value={field.value || 'PRODUCT'}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Category">
                                            {selectedCat && (
                                                <span className="flex items-center gap-2">
                                                    <span className={`w-3 h-3 rounded-full ${selectedCat.color}`} />
                                                    {selectedCat.label}
                                                </span>
                                            )}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORY_OPTIONS.map((opt) => (
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
                </div>

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
            </div>

            {/* Row 2: Scale */}
            <div className="grid grid-cols-2 gap-4">
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
                <div /> {/* Empty space for alignment */}
            </div>

            {/* Row 3: Business Unit & Family (only for PRODUCT projects) */}
            {selectedCategory === 'PRODUCT' && (
            <div className="grid grid-cols-2 gap-4">
                {/* Business Unit */}
                <div>
                    <Label htmlFor="business_unit_id">Business Unit</Label>
                    <Controller
                        name="business_unit_id"
                        control={control}
                        render={({ field }) => (
                            <Select
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    // Clear product_line_id when business unit changes
                                    setValue('product_line_id', '');
                                }}
                                value={field.value || ''}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Business Unit" />
                                </SelectTrigger>
                                <SelectContent>
                                    {businessUnits?.map((bu) => (
                                        <SelectItem key={bu.id} value={bu.id}>
                                            {bu.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>

                {/* Family (formerly Product Line) */}
                <div>
                    <Label htmlFor="product_line_id">Family</Label>
                    <Controller
                        name="product_line_id"
                        control={control}
                        render={({ field }) => (
                            <Select
                                onValueChange={field.onChange}
                                value={field.value || ''}
                                disabled={!selectedBusinessUnitId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={selectedBusinessUnitId ? "Select Family" : "Select Business Unit first"} />
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
            </div>
            )}

            {/* Row 3 alt: Owner Department (only for FUNCTIONAL projects) */}
            {selectedCategory === 'FUNCTIONAL' && (
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="owner_department_id">Owner Department</Label>
                    <Controller
                        name="owner_department_id"
                        control={control}
                        render={({ field }) => (
                            <Select
                                onValueChange={field.onChange}
                                value={field.value || ''}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Owner Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments?.filter((d: Department) => d.is_active).map((dept: Department) => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        Used to group functional projects by department
                    </p>
                </div>
                <div /> {/* Empty space for alignment */}
            </div>
            )}

            {/* Row 4: Project Manager */}
            <div className="grid grid-cols-2 gap-4">
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
                <div /> {/* Empty space for alignment */}
            </div>

            {/* Row 4: Customer & Product */}
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

            {/* Row 5: Start & End Month - Side by side with native date picker */}
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

            {/* Financial Classification Fields */}
            <div className="border-t pt-4 mt-2">
                <h3 className="text-sm font-semibold mb-4 text-gray-700">Financial Classification</h3>

                <div className="grid grid-cols-2 gap-4">
                    {/* Funding Entity */}
                    <div>
                        <Label htmlFor="funding_entity_id">Funding Entity</Label>
                        <Controller
                            name="funding_entity_id"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Funding Entity" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FUNDING_ENTITY_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    {/* Recharge Status */}
                    <div>
                        <Label htmlFor="recharge_status">Recharge Status</Label>
                        <Controller
                            name="recharge_status"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Recharge Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {RECHARGE_STATUS_OPTIONS.map((opt) => (
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

                <div className="grid grid-cols-2 gap-4 mt-4">
                    {/* IO Category */}
                    <div>
                        <Label htmlFor="io_category_code">IO Category</Label>
                        <Controller
                            name="io_category_code"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select IO Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {IO_CATEGORY_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    {/* Capitalizable */}
                    <div>
                        <Label htmlFor="is_capitalizable">Capitalizable (CAPEX vs OPEX)</Label>
                        <Controller
                            name="is_capitalizable"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    onValueChange={(value) => field.onChange(value === 'true')}
                                    value={field.value ? 'true' : 'false'}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Capitalization" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">Yes (CAPEX)</SelectItem>
                                        <SelectItem value="false">No (OPEX)</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                </div>
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
