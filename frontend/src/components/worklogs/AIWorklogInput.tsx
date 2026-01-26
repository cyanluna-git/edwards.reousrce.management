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
            setWarnings(['AI 파싱에 실패했습니다. 다시 시도해주세요.']);
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
                    <Badge variant="secondary">AI 상태 확인 중...</Badge>
                ) : isAIHealthy ? (
                    <Badge variant="default" className="bg-green-600">
                        AI 연결됨 ({healthData?.model})
                    </Badge>
                ) : (
                    <Badge variant="destructive">
                        AI 연결 안됨
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
                            자연어로 업무 입력
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Textarea
                                placeholder={`예시: "오전에 OQC 인프라 DB 설계했고, 오후에 Justin이랑 HRS 관련해서 잠깐 미팅했음"`}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                className="min-h-[120px] resize-none"
                                disabled={!isAIHealthy || parseMutation.isPending}
                            />
                            <p className="text-xs text-muted-foreground">
                                시간 표현: "오전에"(4h), "오후에"(4h), "잠깐"(0.5h), "하루종일"(8h)
                            </p>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                onClick={handleParse}
                                disabled={!inputText.trim() || !isAIHealthy || parseMutation.isPending}
                            >
                                {parseMutation.isPending ? (
                                    <>
                                        <span className="animate-spin mr-2">⏳</span>
                                        분석 중...
                                    </>
                                ) : (
                                    'AI 분석'
                                )}
                            </Button>
                        </div>

                        {!isAIHealthy && !isHealthLoading && (
                            <Alert>
                                <AlertDescription>
                                    AI 서비스에 연결할 수 없습니다. 수동으로 워크로그를 입력해주세요.
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
