/**
 * WorkLog Entry Modal Component
 * Modal for creating/editing worklog entries
 * Now uses hierarchical work type categories and project/product line selection
 */
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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



interface WorkLogFormData {
    project_id?: string | null;
    product_line_id?: string | null;
    work_type_category_id?: number;
    hours: number;
    description?: string;
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
    const { t } = useTranslation('worklogs');

    const { register, handleSubmit, watch, reset, control, setValue, formState: { errors } } = useForm<WorkLogFormData>({
        defaultValues: {
            project_id: null,
            product_line_id: null,
            work_type_category_id: undefined,
            hours: 1,
            description: '',
            is_sudden_work: false,
            is_business_trip: false,
            ...initialData,
        },
    });

    useEffect(() => {
        if (isOpen) {
            reset({
                project_id: null,
                product_line_id: null,
                work_type_category_id: undefined,
                hours: 1,
                description: '',
                is_sudden_work: false,
                is_business_trip: false,
                ...initialData,
            });
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

    const handleProjectChange = (projectId: string | null, _projectName?: string, _category?: string) => {
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

    const handleWorkTypeCategoryChange = (categoryId: number, _category: WorkTypeCategory) => {
        setValue('work_type_category_id', categoryId);
    };


    const watchProductLineId = watch('product_line_id');

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[550px] bg-background border shadow-lg">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? t('entryModal.editTitle') : t('entryModal.addTitle')} - {date}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                    {/* Step 1: Work Type Selection (Always First) */}
                    <div className="space-y-2">
                        <Label>{t('entryModal.workType')} *</Label>
                        <Controller
                            name="work_type_category_id"
                            control={control}
                            rules={{ required: t('entryModal.workTypeRequired') }}
                            render={({ field }) => (
                                <WorkTypeCategorySelect
                                    value={field.value}
                                    onChange={(categoryId, category) => {
                                        field.onChange(categoryId);
                                        handleWorkTypeCategoryChange(categoryId, category);
                                    }}
                                    placeholder={t('entryModal.selectWorkType')}
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
                                {t('entryModal.project')}
                            </Label>
                        </div>
                        <Controller
                            name="project_id"
                            control={control}
                            render={({ field }) => (
                                <ProjectHierarchySelect
                                    projectId={field.value}
                                    productLineId={watchProductLineId}
                                    onProjectChange={handleProjectChange}
                                    onProductLineChange={handleProductLineChange}
                                    projectRequired={false}
                                    placeholder={t('entryModal.selectProject')}
                                    className="w-full"
                                />
                            )}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('entryModal.projectHint')}
                        </p>
                    </div>



                    <div className="space-y-2">
                        <Label htmlFor="hours">{t('entryModal.hours')} *</Label>
                        <Input
                            id="hours"
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="24"
                            {...register('hours', {
                                required: t('entryModal.hoursRequired'),
                                min: { value: 0.5, message: t('entryModal.hoursMin') },
                                max: { value: 24, message: t('entryModal.hoursMax') },
                                valueAsNumber: true,
                            })}
                        />
                        {errors.hours && (
                            <p className="text-red-500 text-sm">{errors.hours.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">{t('entryModal.description')}</Label>
                        <textarea
                            id="description"
                            className="w-full p-2 border rounded-md bg-background min-h-[80px]"
                            placeholder={t('entryModal.descriptionPlaceholder')}
                            {...register('description')}
                        />
                    </div>

                    <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" {...register('is_sudden_work')} />
                            <span className="text-sm">{t('entryModal.suddenWork')}</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" {...register('is_business_trip')} />
                            <span className="text-sm">{t('entryModal.businessTrip')}</span>
                        </label>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('entryModal.cancel')}
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? t('entryModal.saving') : isEditing ? t('entryModal.update') : t('entryModal.add')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default WorkLogEntryModal;
