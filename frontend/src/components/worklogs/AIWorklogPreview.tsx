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
import type { AIWorklogEntry, WorkTypeCategory } from '@/types';

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
        if (confidence >= 0.8) return '높음';
        if (confidence >= 0.5) return '중간';
        return '낮음';
    };

    const handleSaveAll = async () => {
        const activeEntries = entries.filter(e => !e.isDeleted);
        const newErrors: string[] = [];

        for (let i = 0; i < activeEntries.length; i++) {
            const entry = activeEntries[i];
            setSavingIndex(i);

            // Validate entry
            if (!entry.work_type_category_id) {
                newErrors.push(`항목 ${i + 1}: 업무 유형을 선택해주세요`);
                continue;
            }

            if (!entry.hours || entry.hours <= 0) {
                newErrors.push(`항목 ${i + 1}: 유효한 시간을 입력해주세요`);
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
            } catch (error: any) {
                newErrors.push(
                    `항목 ${i + 1}: ${error?.response?.data?.detail || '저장 실패'}`
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
                            AI 분석 결과 ({activeEntries.length}개 항목)
                        </CardTitle>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                                총 시간: <strong className={totalHours > 24 ? 'text-red-500' : ''}>{totalHours}h</strong>
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={onCancel}>
                                    취소
                                </Button>
                                <Button
                                    onClick={handleSaveAll}
                                    disabled={activeEntries.length === 0 || createMutation.isPending}
                                >
                                    {createMutation.isPending ? '저장 중...' : '모두 저장'}
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
                                            항목 {index + 1}
                                        </span>
                                        <Badge
                                            variant="secondary"
                                            className={`${getConfidenceColor(entry.confidence)} text-white`}
                                        >
                                            신뢰도: {getConfidenceText(entry.confidence)} ({Math.round(entry.confidence * 100)}%)
                                        </Badge>
                                        {savingIndex === index && (
                                            <span className="text-sm text-blue-500 animate-pulse">
                                                저장 중...
                                            </span>
                                        )}
                                    </div>
                                    {entry.isDeleted ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => restoreEntry(entry.id)}
                                        >
                                            복원
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700"
                                            onClick={() => deleteEntry(entry.id)}
                                        >
                                            삭제
                                        </Button>
                                    )}
                                </div>

                                {!entry.isDeleted && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Project Selection */}
                                        <div className="space-y-2">
                                            <Label>프로젝트</Label>
                                            <ProjectHierarchySelect
                                                projectId={entry.project_id}
                                                productLineId={null}
                                                onProjectChange={(projectId) =>
                                                    updateEntry(entry.id, { project_id: projectId })
                                                }
                                                onProductLineChange={() => {}}
                                                projectRequired={false}
                                                placeholder={entry.project_name || '프로젝트 선택...'}
                                            />
                                            {entry.project_name && !entry.project_id && (
                                                <p className="text-xs text-yellow-600">
                                                    AI 추천: {entry.project_name} (매칭 필요)
                                                </p>
                                            )}
                                        </div>

                                        {/* Work Type Selection */}
                                        <div className="space-y-2">
                                            <Label>업무 유형 *</Label>
                                            <WorkTypeCategorySelect
                                                value={entry.work_type_category_id || undefined}
                                                onChange={(categoryId, _category: WorkTypeCategory) =>
                                                    updateEntry(entry.id, { work_type_category_id: categoryId })
                                                }
                                                placeholder={entry.work_type_name || '업무 유형 선택...'}
                                            />
                                            {entry.work_type_name && !entry.work_type_category_id && (
                                                <p className="text-xs text-yellow-600">
                                                    AI 추천: {entry.work_type_name} (매칭 필요)
                                                </p>
                                            )}
                                        </div>

                                        {/* Hours */}
                                        <div className="space-y-2">
                                            <Label>시간 (h) *</Label>
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
                                            <Label>설명</Label>
                                            <Input
                                                value={entry.description}
                                                onChange={(e) =>
                                                    updateEntry(entry.id, { description: e.target.value })
                                                }
                                                placeholder="업무 설명"
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
                        모든 항목이 삭제되었습니다. 취소 버튼을 눌러 다시 시작하세요.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};

export default AIWorklogPreview;
