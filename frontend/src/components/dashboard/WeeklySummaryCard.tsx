import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Database,
  History,
  ArrowLeft,
  Calendar,
  Clock,
} from "lucide-react";
import {
  getUserAISummary,
  getTeamAISummary,
  TeamDashboardScope,
  getUserAISummaryHistory,
  getTeamAISummaryHistory,
  AISummaryHistoryItem,
} from "@/api/client";
import { useAIHealth } from "@/hooks/useAIWorklog";

interface WeeklySummaryCardProps {
  mode: "user" | "team";
  scope?: TeamDashboardScope;
  period?: "weekly" | "monthly";
}

export const WeeklySummaryCard: React.FC<WeeklySummaryCardProps> = ({
  mode,
  scope = "department",
  period = "weekly",
}) => {
  const { t } = useTranslation('dashboard');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] =
    useState<AISummaryHistoryItem | null>(null);
  const queryClient = useQueryClient();

  // Check AI health - hide panel if unhealthy
  const { data: healthData, isLoading: healthLoading } = useAIHealth();
  const isAIAvailable = healthData?.status === "healthy";

  // User Summary Query
  const userQuery = useQuery({
    queryKey: ["ai-summary", "user", period],
    queryFn: () => getUserAISummary(period, false),
    enabled: mode === "user" && !selectedHistory && isAIAvailable,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Team Summary Query
  const teamQuery = useQuery({
    queryKey: ["ai-summary", "team", scope, period],
    queryFn: () => getTeamAISummary(scope, period, false),
    enabled: mode === "team" && !selectedHistory && isAIAvailable,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // History Query
  const historyQuery = useQuery({
    queryKey: ["ai-summary-history", mode, scope],
    queryFn: async () => {
      if (mode === "user") {
        return getUserAISummaryHistory(10);
      } else {
        return getTeamAISummaryHistory(scope, 10);
      }
    },
    enabled: isHistoryOpen && isAIAvailable,
  });

  const activeQuery = mode === "user" ? userQuery : teamQuery;
  const isLoading = activeQuery.isLoading || isRegenerating;
  const hasError = activeQuery.isError || activeQuery.data?.error;

  // Determine what data to show
  const displayData = selectedHistory
    ? selectedHistory.summary
    : activeQuery.data;
  const isFromCache = selectedHistory ? true : activeQuery.data?.from_cache;
  const isHistoryView = !!selectedHistory;

  // Force regenerate - bypasses cache
  const handleForceRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    try {
      if (mode === "user") {
        const result = await getUserAISummary(period, true);
        queryClient.setQueryData(["ai-summary", "user", period], result);
      } else {
        const result = await getTeamAISummary(scope, period, true);
        queryClient.setQueryData(["ai-summary", "team", scope, period], result);
      }
    } finally {
      setIsRegenerating(false);
    }
  }, [mode, period, scope, queryClient]);

  const handleHistorySelect = (item: AISummaryHistoryItem) => {
    setSelectedHistory(item);
    setIsHistoryOpen(false);
  };

  const handleBackToCurrent = () => {
    setSelectedHistory(null);
  };

  // Don't render if AI is unavailable (after health check completes)
  // Moved here after all hooks to satisfy Rules of Hooks
  if (!healthLoading && !isAIAvailable) {
    return null;
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            {isHistoryView ? (
              <span className="flex items-center gap-2">
                <span className="text-slate-500">{t('summary.pastSummary')}:</span>
                <span>
                  {selectedHistory.period_start} ~ {selectedHistory.period_end}
                </span>
              </span>
            ) : (
              t('summary.title')
            )}
            {isFromCache && (
              <Badge
                variant="secondary"
                className="text-xs py-0 px-1.5 flex items-center gap-1"
              >
                <Database className="w-3 h-3" />
                {isHistoryView ? t('summary.historyBadge') : t('summary.cacheBadge')}
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-1">
            {isHistoryView ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToCurrent}
                className="h-7 px-2 text-xs flex gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                {t('summary.backToCurrent')}
              </Button>
            ) : (
              <>
                <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title={t('summary.viewPastSummary')}
                    >
                      <History className="w-4 h-4 text-slate-500" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('summary.historyTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="py-2 space-y-2 max-h-[60vh] overflow-y-auto">
                      {historyQuery.isLoading ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          {t('summary.historyLoading')}
                        </div>
                      ) : historyQuery.data?.length === 0 ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          {t('summary.noHistory')}
                        </div>
                      ) : (
                        historyQuery.data?.map((item) => (
                          <Button
                            key={item.id}
                            variant="outline"
                            className="w-full justify-start h-auto py-3 text-left"
                            onClick={() => handleHistorySelect(item)}
                          >
                            <div className="flex flex-col gap-1 w-full">
                              <div className="flex items-center gap-2 font-medium">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                {item.period_start} ~ {item.period_end}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {t('summary.generatedAt')}{" "}
                                {new Date(item.generated_at).toLocaleString()}
                              </div>
                            </div>
                          </Button>
                        ))
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleForceRegenerate}
                  disabled={isLoading}
                  className="h-7 w-7 p-0"
                  title={t('summary.regenerate')}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading && !isHistoryView ? (
          <div className="space-y-2">
            <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-4/6" />
          </div>
        ) : hasError && !isHistoryView ? (
          <div className="text-sm text-red-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {t('summary.error')}
          </div>
        ) : mode === "user" ? (
          <UserSummaryContent data={displayData} t={t} />
        ) : (
          <TeamSummaryContent data={displayData} t={t} />
        )}
      </CardContent>
    </Card>
  );
};

interface UserSummaryContentProps {
  data?: { summary: string[]; generated_at: string };
  t: (key: string, options?: Record<string, unknown>) => string;
}

const UserSummaryContent: React.FC<UserSummaryContentProps> = ({ data, t }) => {
  if (!data?.summary?.length) {
    return (
      <p className="text-sm text-muted-foreground">{t('summary.noData')}</p>
    );
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
  t: (key: string, options?: Record<string, unknown>) => string;
}

const TeamSummaryContent: React.FC<TeamSummaryContentProps> = ({ data, t }) => {
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">{t('summary.noData')}</p>
    );
  }

  const { project_summary, member_summary, issues } = data;
  const hasContent =
    project_summary?.length || member_summary?.length || issues?.length;

  if (!hasContent) {
    return (
      <p className="text-sm text-muted-foreground">{t('summary.noData')}</p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {project_summary?.length > 0 && (
        <div>
          <p className="font-medium text-slate-600 mb-1">{t('summary.byProject')}</p>
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
          <p className="font-medium text-slate-600 mb-1">{t('summary.byMember')}</p>
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
          <p className="font-medium text-amber-600 mb-1">{t('summary.keyIssues')}</p>
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
