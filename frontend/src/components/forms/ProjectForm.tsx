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
import { getProductLines, getUsers, getBusinessUnits, getDepartments, getInternalIOs, getRechargeIOs, type Department } from '@/api/client';

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
                internal_io_id: project.internal_io_id || undefined,
                recharge_io_id: project.recharge_io_id || undefined,
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
    const { data: businessUnits } = useQuery({ queryKey: ['businessUnits'], queryFn: getBusinessUnits });
    const { data: productLines } = useQuery({ queryKey: ['productLines'], queryFn: getProductLines });
    const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() });
    const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => getDepartments() });
    const { data: internalIOs } = useQuery({ queryKey: ['internalIOs'], queryFn: () => getInternalIOs({ is_active: true }) });
    const { data: rechargeIOs } = useQuery({ queryKey: ['rechargeIOs'], queryFn: () => getRechargeIOs({ is_active: true }) });

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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {/* ═══════════════════════════════════════════════════════════════
                SECTION 1: Basic Info
            ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-3">
                {/* Row 1: Project Name */}
                <div className="grid gap-3 grid-cols-1">
                    <div>
                        <Label htmlFor="name" className="text-xs">Project Name</Label>
                        <Input id="name" {...register('name', { required: 'Project Name is required' })} className="h-8" />
                        {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
                    </div>
                </div>

                {/* Row 2: Category, Status, Scale */}
                <div className="grid grid-cols-3 gap-3">
                    {/* Category */}
                    <div>
                        <Label className="text-xs">Category</Label>
                        <Controller
                            name="category"
                            control={control}
                            render={({ field }) => {
                                const selectedCat = CATEGORY_OPTIONS.find(opt => opt.value === field.value);
                                return (
                                    <Select
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            if (value === 'FUNCTIONAL') {
                                                setValue('business_unit_id', '');
                                                setValue('product_line_id', '');
                                            }
                                        }}
                                        value={field.value || 'PRODUCT'}
                                    >
                                        <SelectTrigger className="h-8">
                                            <SelectValue>
                                                {selectedCat && (
                                                    <span className="flex items-center gap-1.5">
                                                        <span className={`w-2 h-2 rounded-full ${selectedCat.color}`} />
                                                        <span className="text-xs">{selectedCat.label}</span>
                                                    </span>
                                                )}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORY_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    <span className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${opt.color}`} />
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
                        <Label className="text-xs">Status</Label>
                        <Controller
                            name="status"
                            control={control}
                            rules={{ required: 'Status is required' }}
                            render={({ field }) => {
                                const selectedStatus = STATUS_OPTIONS.find(opt => opt.value === field.value);
                                return (
                                    <Select onValueChange={field.onChange} value={field.value || 'Prospective'}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue>
                                                {selectedStatus && (
                                                    <span className="flex items-center gap-1.5">
                                                        <span className={`w-2 h-2 rounded-full ${selectedStatus.color}`} />
                                                        <span className="text-xs">{selectedStatus.label}</span>
                                                    </span>
                                                )}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STATUS_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    <span className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${opt.color}`} />
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

                    {/* Scale */}
                    <div>
                        <Label className="text-xs">Scale</Label>
                        <Controller
                            name="scale"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Select" />
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
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SECTION 2: Organization (conditional based on category)
            ═══════════════════════════════════════════════════════════════ */}
            <div className="border-t pt-3">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Organization</h4>

                {selectedCategory === 'PRODUCT' ? (
                    <div className="grid grid-cols-3 gap-3">
                        {/* Business Unit */}
                        <div>
                            <Label className="text-xs">Business Unit</Label>
                            <Controller
                                name="business_unit_id"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            setValue('product_line_id', '');
                                        }}
                                        value={field.value || ''}
                                    >
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Select" />
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

                        {/* Family */}
                        <div>
                            <Label className="text-xs">Family</Label>
                            <Controller
                                name="product_line_id"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value || ''}
                                        disabled={!selectedBusinessUnitId}
                                    >
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder={selectedBusinessUnitId ? "Select" : "Select BU first"} />
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

                        {/* PM */}
                        <div>
                            <Label className="text-xs">Project Manager</Label>
                            <Controller
                                name="pm_id"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Select PM" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {pmUsers.map((u) => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        {/* Owner Department */}
                        <div>
                            <Label className="text-xs">Owner Department</Label>
                            <Controller
                                name="owner_department_id"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Select" />
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
                        </div>

                        {/* PM */}
                        <div>
                            <Label className="text-xs">Project Manager</Label>
                            <Controller
                                name="pm_id"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Select PM" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {pmUsers.map((u) => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                        <div /> {/* Empty for alignment */}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SECTION 3: Details (Customer, Product, Period)
            ═══════════════════════════════════════════════════════════════ */}
            <div className="border-t pt-3">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Details</h4>

                <div className="grid grid-cols-4 gap-3">
                    <div>
                        <Label className="text-xs">Customer</Label>
                        <Input id="customer" {...register('customer')} className="h-8" />
                    </div>
                    <div>
                        <Label className="text-xs">Product</Label>
                        <Input id="product" {...register('product')} className="h-8" />
                    </div>
                    <div>
                        <Label className="text-xs">Start</Label>
                        <input
                            id="start_month"
                            type="month"
                            {...register('start_month')}
                            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                        />
                    </div>
                    <div>
                        <Label className="text-xs">End</Label>
                        <input
                            id="end_month"
                            type="month"
                            {...register('end_month')}
                            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                        />
                    </div>
                </div>

                {/* Description - compact */}
                <div className="mt-2">
                    <Label className="text-xs">Description</Label>
                    <textarea
                        id="description"
                        {...register('description')}
                        className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                        placeholder="Brief description..."
                        rows={2}
                    />
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SECTION 5: Internal Order & Recharge IO
            ═══════════════════════════════════════════════════════════════ */}
            <div className="border-t pt-3">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Financial Tracking</h4>

                <div className="grid grid-cols-2 gap-3">
                    {/* Internal IO */}
                    <div>
                        <Label className="text-xs">Internal IO</Label>
                        <Controller
                            name="internal_io_id"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    onValueChange={(value) => field.onChange(value === 'none' ? undefined : value)}
                                    value={field.value || 'none'}
                                >
                                    <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Select Internal IO" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {internalIOs?.map((io) => (
                                            <SelectItem key={io.id} value={io.id}>
                                                {io.io_number} - {io.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    {/* Recharge IO */}
                    <div>
                        <Label className="text-xs">Recharge IO</Label>
                        <Controller
                            name="recharge_io_id"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    onValueChange={(value) => field.onChange(value === 'none' ? undefined : value)}
                                    value={field.value || 'none'}
                                >
                                    <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Select Recharge IO" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {rechargeIOs?.map((io) => (
                                            <SelectItem key={io.id} value={io.id}>
                                                {io.io_number} - {io.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                </div>
            </div>

            {isError && <p className="text-red-500 text-xs mt-2">Error: {error?.message}</p>}

            <div className="flex justify-end gap-2 pt-3 border-t mt-3">
                {onCancel && <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>}
                <Button
                    type="submit"
                    size="sm"
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
