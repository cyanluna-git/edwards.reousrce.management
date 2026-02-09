/**
 * AI WorkLog Preview Component
 * Preview and edit AI-parsed worklog entries before saving
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WorkTypeCategorySelect } from '@/components/WorkTypeCategorySelect';
import { ProjectHierarchySelect } from '@/components/ProjectHierarchySelect';
import { useCreateWorklog } from '@/hooks/useWorklogs';
import { useApiError } from '@/hooks/useApiError';
import type { AIWorklogEntry, WorkTypeCategory } from '@/types';
import { useTranslation } from 'react-i18next';

interface EditableEntry extends AIWorklogEntry {
    id: string; // Temporary ID for tracking
    isDeleted?: boolean;
}

interface AIWorklogPreviewProps {
    entries: AIWorklogEntry[];
    targetDate: string;
    userId: string;
    onSaveComplete: () => void;
    onCancel: () => void;
}

export const AIWorklogPreview: React.FC<AIWorklogPreviewProps> = ({
    entries: initialEntries,
    targetDate,
    userId,
    onSaveComplete,
    onCancel,
}) => {
    const [entries, setEntries] = useState<EditableEntry[]>(() =>
        initialEntries.map((entry, idx) => ({
            ...entry,
            id: `temp-${idx}-${Date.now()}`,
        }))
    );
    const [savingIndex, setSavingIndex] = useState<number | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const { t } = useTranslation('worklogs');
    const getErrorMessage = useApiError();

    const createMutation = useCreateWorklog();

    const updateEntry = (id: string, updates: Partial<EditableEntry>) => {
        setEntries(prev =>
            prev.map(entry =>
                entry.id === id ? { ...entry, ...updates } : entry
            )
        );
    };

    const deleteEntry = (id: string) => {
        setEntries(prev =>
            prev.map(entry =>
                entry.id === id ? { ...entry, isDeleted: true } : entry
            )
        );
    };

    const restoreEntry = (id: string) => {
        setEntries(prev =>
            prev.map(entry =>
                entry.id === id ? { ...entry, isDeleted: false } : entry
            )
        );
    };

    const getConfidenceColor = (confidence: number): string => {
        if (confidence >= 0.8) return 'bg-green-500';
        if (confidence >= 0.5) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getConfidenceText = (confidence: number): string => {
        if (confidence >= 0.8) return t('ai.confidenceHigh');
        if (confidence >= 0.5) return t('ai.confidenceMedium');
        return t('ai.confidenceLow');
    };

    const handleSaveAll = async () => {
        const activeEntries = entries.filter(e => !e.isDeleted);
        const newErrors: string[] = [];

        for (let i = 0; i < activeEntries.length; i++) {
            const entry = activeEntries[i];
            setSavingIndex(i);

            // Validate entry
            if (!entry.work_type_category_id) {
                newErrors.push(t('ai.validationWorkType', { number: i + 1 }));
                continue;
            }

            if (!entry.hours || entry.hours <= 0) {
                newErrors.push(t('ai.validationHours', { number: i + 1 }));
                continue;
            }

            try {
                await createMutation.mutateAsync({
                    date: targetDate,
                    user_id: userId,
                    project_id: entry.project_id || undefined,
                    work_type_category_id: entry.work_type_category_id,
                    hours: entry.hours,
                    description: entry.description || undefined,
                    is_sudden_work: false,
                    is_business_trip: false,
                });
            } catch (error: unknown) {
                newErrors.push(
                    t('ai.itemSaveFailed', { number: i + 1, error: getErrorMessage(error) })
                );
            }
        }

        setSavingIndex(null);
        setErrors(newErrors);

        if (newErrors.length === 0) {
            onSaveComplete();
        }
    };

    const activeEntries = entries.filter(e => !e.isDeleted);
    const totalHours = activeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

    return (
        <div className="space-y-4">
            {/* Summary Header */}
            <Card>
                <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                            {t('ai.previewTitle', { count: activeEntries.length })}
                        </CardTitle>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                                {t('ai.totalHours')} <strong className={totalHours > 24 ? 'text-red-500' : ''}>{totalHours}h</strong>
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={onCancel}>
                                    {t('common:buttons.cancel')}
                                </Button>
                                <Button
                                    onClick={handleSaveAll}
                                    disabled={activeEntries.length === 0 || createMutation.isPending}
                                >
                                    {createMutation.isPending ? t('common:status.processing') : t('ai.saveAll')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Errors */}
            {errors.length > 0 && (
                <Alert variant="destructive">
                    <AlertDescription>
                        <ul className="list-disc list-inside">
                            {errors.map((error, idx) => (
                                <li key={idx}>{error}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* Entry Cards */}
            <div className="space-y-3">
                {entries.map((entry, index) => (
                    <Card
                        key={entry.id}
                        className={entry.isDeleted ? 'opacity-50' : ''}
                    >
                        <CardContent className="py-4">
                            <div className="space-y-4">
                                {/* Header Row */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                            {t('ai.itemNumber', { number: index + 1 })}
                                        </span>
                                        <Badge
                                            variant="secondary"
                                            className={`${getConfidenceColor(entry.confidence)} text-white`}
                                        >
                                            {t('ai.confidence', { level: getConfidenceText(entry.confidence), percent: Math.round(entry.confidence * 100) })}
                                        </Badge>
                                        {savingIndex === index && (
                                            <span className="text-sm text-blue-500 animate-pulse">
                                                {t('common:status.processing')}
                                            </span>
                                        )}
                                    </div>
                                    {entry.isDeleted ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => restoreEntry(entry.id)}
                                        >
                                            {t('ai.restore')}
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700"
                                            onClick={() => deleteEntry(entry.id)}
                                        >
                                            {t('common:buttons.delete')}
                                        </Button>
                                    )}
                                </div>

                                {!entry.isDeleted && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Project Selection */}
                                        <div className="space-y-2">
                                            <Label>{t('entry.project')}</Label>
                                            <ProjectHierarchySelect
                                                projectId={entry.project_id}
                                                productLineId={null}
                                                onProjectChange={(projectId, _name, _category) =>
                                                    updateEntry(entry.id, { project_id: projectId })
                                                }
                                                onProductLineChange={() => {}}
                                                projectRequired={false}
                                                placeholder={entry.project_name || t('ai.selectProject')}
                                            />
                                            {entry.project_name && !entry.project_id && (
                                                <p className="text-xs text-yellow-600">
                                                    {t('ai.aiRecommend', { name: entry.project_name })}
                                                </p>
                                            )}
                                        </div>

                                        {/* Work Type Selection */}
                                        <div className="space-y-2">
                                            <Label>{t('ai.workTypeRequired')}</Label>
                                            <WorkTypeCategorySelect
                                                value={entry.work_type_category_id || undefined}
                                                onChange={(categoryId, _category: WorkTypeCategory) =>
                                                    updateEntry(entry.id, { work_type_category_id: categoryId })
                                                }
                                                placeholder={entry.work_type_name || t('ai.selectWorkType')}
                                            />
                                            {entry.work_type_name && !entry.work_type_category_id && (
                                                <p className="text-xs text-yellow-600">
                                                    {t('ai.aiRecommend', { name: entry.work_type_name })}
                                                </p>
                                            )}
                                        </div>

                                        {/* Hours */}
                                        <div className="space-y-2">
                                            <Label>{t('ai.hoursRequired')}</Label>
                                            <Input
                                                type="number"
                                                step="0.5"
                                                min="0.5"
                                                max="24"
                                                value={entry.hours}
                                                onChange={(e) =>
                                                    updateEntry(entry.id, {
                                                        hours: parseFloat(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        </div>

                                        {/* Description */}
                                        <div className="space-y-2">
                                            <Label>{t('entry.description')}</Label>
                                            <Input
                                                value={entry.description}
                                                onChange={(e) =>
                                                    updateEntry(entry.id, { description: e.target.value })
                                                }
                                                placeholder={t('ai.descriptionPlaceholder')}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {activeEntries.length === 0 && (
                <Alert>
                    <AlertDescription>
                        {t('ai.allDeleted')}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};

export default AIWorklogPreview;
