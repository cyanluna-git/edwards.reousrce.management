/**
 * WorkLog Entry Modal Component
 * Modal for creating/editing worklog entries
 * Now uses hierarchical work type categories and project/product line selection
 */
import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WorkTypeCategorySelect } from '@/components/WorkTypeCategorySelect';
import { ProjectHierarchySelect } from '@/components/ProjectHierarchySelect';
import type { WorkLogCreate, WorkLogUpdate, Project, WorkTypeCategory } from '@/types';

const MEETING_TYPES = [
    { value: 'DECISION_MAKING', label: 'Decision Making' },
    { value: 'INFO_SHARING', label: 'Information Sharing' },
    { value: 'FEEDBACK', label: 'Feedback' },
    { value: 'PERIODIC_UPDATE', label: 'Periodic Update' },
    { value: 'PROBLEM_SOLVING', label: 'Problem Solving' },
];

interface WorkLogFormData {
    project_id?: string | null;
    product_line_id?: string | null;
    work_type: string;
    work_type_category_id?: number;
    hours: number;
    description?: string;
    meeting_type?: string;
    is_sudden_work: boolean;
    is_business_trip: boolean;
}

interface WorkLogEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: WorkLogCreate | WorkLogUpdate) => void;
    date: string;
    userId: string;
    projects: Project[];
    initialData?: Partial<WorkLogFormData>;
    isEditing?: boolean;
    isLoading?: boolean;
}

export const WorkLogEntryModal: React.FC<WorkLogEntryModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    date,
    userId,
    projects: _projects,  // Kept for backward compatibility but using hierarchy now
    initialData,
    isEditing = false,
    isLoading = false,
}) => {

    const { register, handleSubmit, watch, reset, control, setValue, formState: { errors } } = useForm<WorkLogFormData>({
        defaultValues: {
            project_id: null,
            product_line_id: null,
            work_type: '',
            work_type_category_id: undefined,
            hours: 1,
            description: '',
            meeting_type: '',
            is_sudden_work: false,
            is_business_trip: false,
            ...initialData,
        },
    });

    const [projectRequired, setProjectRequired] = useState(true);


    const workType = watch('work_type');
    const showMeetingType = workType === 'Meeting' || workType === 'MEETING' || workType?.includes('MTG');

    useEffect(() => {
        if (isOpen) {
            reset({
                project_id: null,
                product_line_id: null,
                work_type: '',
                work_type_category_id: undefined,
                hours: 1,
                description: '',
                meeting_type: '',
                is_sudden_work: false,
                is_business_trip: false,
                ...initialData,
            });
            setProjectRequired(true);
        }
    }, [isOpen, initialData, reset]);


    const handleFormSubmit = (data: WorkLogFormData) => {
        // Clean up null values
        const cleanData = {
            ...data,
            project_id: data.project_id || undefined,
            product_line_id: data.product_line_id || undefined,
        };

        if (isEditing) {
            onSubmit(cleanData as WorkLogUpdate);
        } else {
            onSubmit({
                ...cleanData,
                date,
                user_id: userId,
            } as WorkLogCreate);
        }
    };

    const handleProjectChange = (projectId: string | null) => {
        setValue('project_id', projectId);
        if (projectId) {
            setValue('product_line_id', null);
        }
    };

    const handleProductLineChange = (productLineId: string | null) => {
        setValue('product_line_id', productLineId);
        if (productLineId) {
            setValue('project_id', null);
        }
    };

    const handleWorkTypeCategoryChange = (categoryId: number, category: WorkTypeCategory) => {
        setValue('work_type_category_id', categoryId);
        setValue('work_type', category.name);

        // Update project required based on category
        // Note: project_required comes from backend, default to true if not set
        const required = category.project_required !== false;
        setProjectRequired(required);
    };


    const watchProjectId = watch('project_id');
    const watchProductLineId = watch('product_line_id');

    // Validate project/product line selection
    const isProjectSelectionValid = () => {
        if (!projectRequired) return true;
        return !!watchProjectId || !!watchProductLineId;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[550px] bg-background border shadow-lg">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? 'Edit WorkLog' : 'Add WorkLog'} - {date}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                    {/* Step 1: Work Type Selection (Always First) */}
                    <div className="space-y-2">
                        <Label>Work Type *</Label>
                        <Controller
                            name="work_type_category_id"
                            control={control}
                            rules={{ required: 'Work type is required' }}
                            render={({ field }) => (
                                <WorkTypeCategorySelect
                                    value={field.value}
                                    onChange={(categoryId, category) => {
                                        field.onChange(categoryId);
                                        handleWorkTypeCategoryChange(categoryId, category);
                                    }}
                                    placeholder="업무 유형 선택..."
                                    className="w-full"
                                />
                            )}
                        />
                        {errors.work_type_category_id && (
                            <p className="text-red-500 text-sm">{errors.work_type_category_id.message}</p>
                        )}
                    </div>

                    {/* Step 2: Project / Product Line Selection */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>
                                프로젝트 / 제품군 {projectRequired ? '*' : '(선택사항)'}
                            </Label>
                            {!projectRequired && (
                                <span className="text-xs text-muted-foreground">
                                    이 업무 유형은 프로젝트 선택이 선택사항입니다
                                </span>
                            )}
                        </div>
                        <Controller
                            name="project_id"
                            control={control}
                            rules={{
                                validate: () => isProjectSelectionValid() || '프로젝트 또는 제품군을 선택해주세요'
                            }}
                            render={({ field }) => (
                                <ProjectHierarchySelect
                                    projectId={field.value}
                                    productLineId={watchProductLineId}
                                    onProjectChange={handleProjectChange}
                                    onProductLineChange={handleProductLineChange}
                                    projectRequired={projectRequired}
                                    placeholder={projectRequired ? '프로젝트/제품군 선택 (필수)...' : '프로젝트/제품군 선택 (선택사항)...'}
                                    className="w-full"
                                />
                            )}
                        />
                        {errors.project_id && projectRequired && (
                            <p className="text-red-500 text-sm">{errors.project_id.message}</p>
                        )}
                    </div>

                    {showMeetingType && (
                        <div className="space-y-2">
                            <Label htmlFor="meeting_type">Meeting Type</Label>
                            <select
                                id="meeting_type"
                                className="w-full p-2 border rounded-md bg-background"
                                {...register('meeting_type')}
                            >
                                <option value="">Select meeting type...</option>
                                {MEETING_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="hours">Hours *</Label>
                        <Input
                            id="hours"
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="24"
                            {...register('hours', {
                                required: 'Hours is required',
                                min: { value: 0.5, message: 'Minimum 0.5 hours' },
                                max: { value: 24, message: 'Maximum 24 hours' },
                                valueAsNumber: true,
                            })}
                        />
                        {errors.hours && (
                            <p className="text-red-500 text-sm">{errors.hours.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <textarea
                            id="description"
                            className="w-full p-2 border rounded-md bg-background min-h-[80px]"
                            placeholder="What did you work on?"
                            {...register('description')}
                        />
                    </div>

                    <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" {...register('is_sudden_work')} />
                            <span className="text-sm">Sudden/Urgent Work</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" {...register('is_business_trip')} />
                            <span className="text-sm">Business Trip</span>
                        </label>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Add'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default WorkLogEntryModal;
