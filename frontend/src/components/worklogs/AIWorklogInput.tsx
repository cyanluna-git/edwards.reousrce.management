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
                        {/* 입력 가이드 */}
                        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-2">💡 이렇게 입력해보세요</p>
                            <ul className="space-y-1 text-xs">
                                <li>• OQC 킥오프 미팅 준비하고 계획서 메일 배포 <span className="text-primary font-medium">2시간</span></li>
                                <li>• 팀원과 1:1 미팅 <span className="text-primary font-medium">1시간</span></li>
                                <li>• GEN3 프로젝트 코드 리뷰하고 머지함 <span className="text-primary font-medium">1시간</span></li>
                                <li>• Innovation 활동으로 Dashboard 개발 <span className="text-primary font-medium">4시간</span></li>
                            </ul>
                        </div>

                        <div className="space-y-2">
                            <Textarea
                                placeholder={`오늘 한 일을 자유롭게 적어주세요...

예: HRS 설계 리뷰 미팅 2시간, OQC 인프라 DB 설계 오전에 함, 오후에 문서 작성`}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                className="min-h-[140px] resize-none"
                                disabled={!isAIHealthy || parseMutation.isPending}
                            />
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span className="bg-muted px-2 py-0.5 rounded">오전에 = 4h</span>
                                <span className="bg-muted px-2 py-0.5 rounded">오후에 = 4h</span>
                                <span className="bg-muted px-2 py-0.5 rounded">잠깐 = 0.5h</span>
                                <span className="bg-muted px-2 py-0.5 rounded">하루종일 = 8h</span>
                                <span className="bg-muted px-2 py-0.5 rounded">N시간 = N</span>
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
