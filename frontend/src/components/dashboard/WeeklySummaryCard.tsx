import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw, AlertTriangle, Database } from 'lucide-react';
import { getUserAISummary, getTeamAISummary, TeamDashboardScope } from '@/api/client';
import { useAIHealth } from '@/hooks/useAIWorklog';

interface WeeklySummaryCardProps {
    mode: 'user' | 'team';
    scope?: TeamDashboardScope;
    period?: 'weekly' | 'monthly';
}

export const WeeklySummaryCard: React.FC<WeeklySummaryCardProps> = ({
    mode,
    scope = 'department',
    period = 'weekly',
}) => {
    const [isRegenerating, setIsRegenerating] = useState(false);
    const queryClient = useQueryClient();

    // Check AI health - hide panel if unhealthy
    const { data: healthData, isLoading: healthLoading } = useAIHealth();
    const isAIAvailable = healthData?.status === 'healthy';

    // Don't render if AI is unavailable (after health check completes)
    if (!healthLoading && !isAIAvailable) {
        return null;
    }

    // User Summary Query
    const userQuery = useQuery({
        queryKey: ['ai-summary', 'user', period],
        queryFn: () => getUserAISummary(period, false),
        enabled: mode === 'user',
        staleTime: 10 * 60 * 1000, // 10 minutes (longer since we cache)
        refetchOnWindowFocus: false,
    });

    // Team Summary Query
    const teamQuery = useQuery({
        queryKey: ['ai-summary', 'team', scope, period],
        queryFn: () => getTeamAISummary(scope, period, false),
        enabled: mode === 'team',
        staleTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
    });

    const query = mode === 'user' ? userQuery : teamQuery;

    // Force regenerate - bypasses cache
    const handleForceRegenerate = useCallback(async () => {
        setIsRegenerating(true);
        try {
            if (mode === 'user') {
                const result = await getUserAISummary(period, true);
                queryClient.setQueryData(['ai-summary', 'user', period], result);
            } else {
                const result = await getTeamAISummary(scope, period, true);
                queryClient.setQueryData(['ai-summary', 'team', scope, period], result);
            }
        } finally {
            setIsRegenerating(false);
        }
    }, [mode, period, scope, queryClient]);

    const isLoading = query.isLoading || isRegenerating;
    const hasError = query.isError || query.data?.error;
    const isFromCache = query.data?.from_cache;

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        AI 주간 업무 요약
                        {isFromCache && (
                            <Badge variant="secondary" className="text-xs py-0 px-1.5 flex items-center gap-1">
                                <Database className="w-3 h-3" />
                                캐시
                            </Badge>
                        )}
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleForceRegenerate}
                        disabled={isLoading}
                        className="h-7 w-7 p-0"
                        title="AI로 다시 생성하기"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-2">
                {isLoading ? (
                    <div className="space-y-2">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6" />
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-4/6" />
                    </div>
                ) : hasError ? (
                    <div className="text-sm text-red-500 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        요약 생성 중 오류가 발생했습니다
                    </div>
                ) : mode === 'user' ? (
                    <UserSummaryContent data={userQuery.data} />
                ) : (
                    <TeamSummaryContent data={teamQuery.data} />
                )}
            </CardContent>
        </Card>
    );
};


interface UserSummaryContentProps {
    data?: { summary: string[]; generated_at: string };
}

const UserSummaryContent: React.FC<UserSummaryContentProps> = ({ data }) => {
    if (!data?.summary?.length) {
        return <p className="text-sm text-muted-foreground">요약할 데이터가 없습니다.</p>;
    }

    return (
        <ul className="space-y-1.5 text-sm">
            {data.summary.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">•</span>
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    );
};

interface TeamSummaryContentProps {
    data?: {
        project_summary: string[];
        member_summary: string[];
        issues: string[];
        generated_at: string;
    };
}

const TeamSummaryContent: React.FC<TeamSummaryContentProps> = ({ data }) => {
    if (!data) {
        return <p className="text-sm text-muted-foreground">요약할 데이터가 없습니다.</p>;
    }

    const { project_summary, member_summary, issues } = data;
    const hasContent = project_summary?.length || member_summary?.length || issues?.length;

    if (!hasContent) {
        return <p className="text-sm text-muted-foreground">요약할 데이터가 없습니다.</p>;
    }

    return (
        <div className="space-y-3 text-sm">
            {project_summary?.length > 0 && (
                <div>
                    <p className="font-medium text-slate-600 mb-1">📁 프로젝트별</p>
                    <ul className="space-y-0.5 pl-1">
                        {project_summary.map((item, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <span className="text-slate-400 mt-0.5">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {member_summary?.length > 0 && (
                <div>
                    <p className="font-medium text-slate-600 mb-1">👤 멤버별</p>
                    <ul className="space-y-0.5 pl-1">
                        {member_summary.map((item, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <span className="text-slate-400 mt-0.5">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {issues?.length > 0 && (
                <div>
                    <p className="font-medium text-amber-600 mb-1">⚠️ 주요 이슈</p>
                    <ul className="space-y-0.5 pl-1">
                        {issues.map((item, index) => (
                            <li key={index} className="flex items-start gap-2 text-amber-700">
                                <span className="text-amber-400 mt-0.5">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default WeeklySummaryCard;
