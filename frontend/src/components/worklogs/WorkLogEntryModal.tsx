/**
 * WorkLog Entry Modal Component
 * Modal for creating/editing worklog entries
 */
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import type { WorkLogCreate, WorkLogUpdate, Project } from '@/types';

// Work type options
const WORK_TYPES = [
    { value: 'DESIGN', label: 'Design' },
    { value: 'SW_DEVELOP', label: 'Software Development' },
    { value: 'VERIFICATION', label: 'Verification' },
    { value: 'DOCUMENTATION', label: 'Documentation' },
    { value: 'REVIEW', label: 'Review' },
    { value: 'MEETING', label: 'Meeting' },
    { value: 'CUSTOMER_SUPPORT', label: 'Customer Support' },
    { value: 'FIELD_WORK', label: 'Field Work' },
    { value: 'TRAINING', label: 'Training' },
    { value: 'ADMIN_WORK', label: 'Administrative Work' },
];

const MEETING_TYPES = [
    { value: 'DECISION_MAKING', label: 'Decision Making' },
    { value: 'INFO_SHARING', label: 'Information Sharing' },
    { value: 'FEEDBACK', label: 'Feedback' },
    { value: 'PERIODIC_UPDATE', label: 'Periodic Update' },
    { value: 'PROBLEM_SOLVING', label: 'Problem Solving' },
];

interface WorkLogFormData {
    project_id: string;
    work_type: string;
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
    projects,
    initialData,
    isEditing = false,
    isLoading = false,
}) => {
    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<WorkLogFormData>({
        defaultValues: {
            project_id: '',
            work_type: 'DESIGN',
            hours: 1,
            description: '',
            meeting_type: '',
            is_sudden_work: false,
            is_business_trip: false,
            ...initialData,
        },
    });

    const workType = watch('work_type');
    const showMeetingType = workType === 'MEETING';

    useEffect(() => {
        if (isOpen) {
            reset({
                project_id: '',
                work_type: 'DESIGN',
                hours: 1,
                description: '',
                meeting_type: '',
                is_sudden_work: false,
                is_business_trip: false,
                ...initialData,
            });
        }
    }, [isOpen, initialData, reset]);

    const handleFormSubmit = (data: WorkLogFormData) => {
        if (isEditing) {
            onSubmit(data as WorkLogUpdate);
        } else {
            onSubmit({
                ...data,
                date,
                user_id: userId,
            } as WorkLogCreate);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] bg-background border shadow-lg">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? 'Edit WorkLog' : 'Add WorkLog'} - {date}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="project_id">Project *</Label>
                        <select
                            id="project_id"
                            className="w-full p-2 border rounded-md bg-background"
                            {...register('project_id', { required: 'Project is required' })}
                        >
                            <option value="">Select a project...</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.code} - {project.name}
                                </option>
                            ))}
                        </select>
                        {errors.project_id && (
                            <p className="text-red-500 text-sm">{errors.project_id.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="work_type">Work Type *</Label>
                        <select
                            id="work_type"
                            className="w-full p-2 border rounded-md bg-background"
                            {...register('work_type', { required: 'Work type is required' })}
                        >
                            {WORK_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
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
