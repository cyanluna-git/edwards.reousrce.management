/**
 * AI WorkLog Input Component
 * Natural language input for AI-assisted worklog entry
 */
import React, { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AIWorklogPreview } from './AIWorklogPreview';
import { useAIHealth, useAIWorklogParse } from '@/hooks/useAIWorklog';
import { useAuth } from '@/hooks/useAuth';
import type { AIWorklogEntry } from '@/types';
import { useTranslation } from 'react-i18next';

interface AIWorklogInputProps {
    targetDate: Date;
    onComplete?: () => void;
}

export const AIWorklogInput: React.FC<AIWorklogInputProps> = ({
    targetDate,
    onComplete,
}) => {
    const { user } = useAuth();
    const [inputText, setInputText] = useState('');
    const [parsedEntries, setParsedEntries] = useState<AIWorklogEntry[] | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const { t } = useTranslation('worklogs');

    const { data: healthData, isLoading: isHealthLoading } = useAIHealth();
    const parseMutation = useAIWorklogParse();

    const isAIHealthy = healthData?.status === 'healthy';

    const handleParse = async () => {
        if (!inputText.trim() || !user?.id) return;

        try {
            const result = await parseMutation.mutateAsync({
                text: inputText,
                user_id: user.id,
                target_date: format(targetDate, 'yyyy-MM-dd'),
            });

            setParsedEntries(result.entries);
            setWarnings(result.warnings);
        } catch (error) {
            console.error('AI parsing failed:', error);
            setWarnings([t('ai.parseFailed')]);
        }
    };

    const handleSaveComplete = () => {
        setParsedEntries(null);
        setWarnings([]);
        setInputText('');
        onComplete?.();
    };

    const handleCancel = () => {
        setParsedEntries(null);
        setWarnings([]);
    };

    return (
        <div className="space-y-4">
            {/* AI Status Indicator */}
            <div className="flex items-center gap-2">
                {isHealthLoading ? (
                    <Badge variant="secondary">{t('ai.statusChecking')}</Badge>
                ) : isAIHealthy ? (
                    <Badge variant="default" className="bg-green-600">
                        {t('ai.connected', { model: healthData?.model })}
                    </Badge>
                ) : (
                    <Badge variant="destructive">
                        {t('ai.disconnected')}
                    </Badge>
                )}
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
                <Alert variant="destructive">
                    <AlertDescription>
                        <ul className="list-disc list-inside">
                            {warnings.map((warning, idx) => (
                                <li key={idx}>{warning}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* Input or Preview */}
            {parsedEntries === null ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            {t('ai.inputTitle')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* 입력 가이드 */}
                        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-2">{t('ai.inputGuideTitle')}</p>
                            <ul className="space-y-1 text-xs">
                                <li>{t('ai.inputGuideEx1')} <span className="text-primary font-medium">2시간</span></li>
                                <li>{t('ai.inputGuideEx2')} <span className="text-primary font-medium">1시간</span></li>
                                <li>{t('ai.inputGuideEx3')} <span className="text-primary font-medium">1시간</span></li>
                                <li>{t('ai.inputGuideEx4')} <span className="text-primary font-medium">4시간</span></li>
                            </ul>
                        </div>

                        <div className="space-y-2">
                            <Textarea
                                placeholder={t('ai.inputPlaceholder')}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                className="min-h-[140px] resize-none"
                                disabled={!isAIHealthy || parseMutation.isPending}
                            />
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span className="bg-muted px-2 py-0.5 rounded">{t('ai.shortcutMorning')}</span>
                                <span className="bg-muted px-2 py-0.5 rounded">{t('ai.shortcutAfternoon')}</span>
                                <span className="bg-muted px-2 py-0.5 rounded">{t('ai.shortcutBrief')}</span>
                                <span className="bg-muted px-2 py-0.5 rounded">{t('ai.shortcutAllDay')}</span>
                                <span className="bg-muted px-2 py-0.5 rounded">{t('ai.shortcutNHours')}</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                onClick={handleParse}
                                disabled={!inputText.trim() || !isAIHealthy || parseMutation.isPending}
                            >
                                {parseMutation.isPending ? (
                                    <>
                                        <span className="animate-spin mr-2">⏳</span>
                                        {t('ai.analyzing')}
                                    </>
                                ) : (
                                    t('ai.analyzeButton')
                                )}
                            </Button>
                        </div>

                        {!isAIHealthy && !isHealthLoading && (
                            <Alert>
                                <AlertDescription>
                                    {t('ai.serviceUnavailable')}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <AIWorklogPreview
                    entries={parsedEntries}
                    targetDate={format(targetDate, 'yyyy-MM-dd')}
                    userId={user?.id || ''}
                    onSaveComplete={handleSaveComplete}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
};

export default AIWorklogInput;
