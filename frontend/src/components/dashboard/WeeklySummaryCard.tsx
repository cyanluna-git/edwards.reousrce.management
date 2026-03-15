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
  WandSparkles,
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
  period?: "weekly" | "monthly" | "quarterly" | "halfYear" | "yearly";
}

type SupportedSummaryPeriod = "weekly" | "monthly";

const isSupportedSummaryPeriod = (
  period: WeeklySummaryCardProps["period"]
): period is SupportedSummaryPeriod => period === "weekly" || period === "monthly";

const getHistoryPeriodKind = (periodStart: string, periodEnd: string): SupportedSummaryPeriod | null => {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (diffDays === 6) {
    return "weekly";
  }

  if (
    start.getDate() === 1 &&
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()
  ) {
    return "monthly";
  }

  return null;
};

export const WeeklySummaryCard: React.FC<WeeklySummaryCardProps> = ({
  mode,
  scope = "department",
  period = "weekly",
}) => {
  const { t } = useTranslation('dashboard');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedHistory, setSelectedHistory] =
    useState<AISummaryHistoryItem | null>(null);
  const queryClient = useQueryClient();

  // Check AI health - hide panel if unhealthy
  const { data: healthData, isLoading: healthLoading } = useAIHealth();
  const isAIAvailable = healthData?.status === "healthy";
  const isSupportedPeriod = isSupportedSummaryPeriod(period);

  // User Summary Query
  const userQuery = useQuery({
    queryKey: ["ai-summary", "user", period],
    queryFn: () => getUserAISummary(isSupportedPeriod ? period : "weekly", false),
    enabled: mode === "user" && !selectedHistory && isAIAvailable && isSupportedPeriod,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Team Summary Query
  const teamQuery = useQuery({
    queryKey: ["ai-summary", "team", scope, period],
    queryFn: () => getTeamAISummary(scope, isSupportedPeriod ? period : "weekly", false),
    enabled: mode === "team" && !selectedHistory && isAIAvailable && isSupportedPeriod,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // History Query
  const historyQuery = useQuery({
    queryKey: ["ai-summary-history", mode, scope, period],
    queryFn: async () => {
      if (mode === "user") {
        return getUserAISummaryHistory(10);
      } else {
        return getTeamAISummaryHistory(scope, 10);
      }
    },
    enabled: isHistoryOpen && isAIAvailable && isSupportedPeriod,
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
  const filteredHistoryItems = historyQuery.data?.filter(
    (item) => getHistoryPeriodKind(item.period_start, item.period_end) === period
  ) ?? [];

  const formatDateRange = useCallback((periodStart: string, periodEnd: string) => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return `${formatter.format(new Date(periodStart))} ~ ${formatter.format(new Date(periodEnd))}`;
  }, []);

  const getRelativeLabel = useCallback((targetPeriod: SupportedSummaryPeriod) => {
    return targetPeriod === "weekly" ? t("summary.lastWeek") : t("summary.lastMonth");
  }, [t]);

  const currentPeriodLabel = isSupportedPeriod && activeQuery.data
    ? `${getRelativeLabel(period)} (${formatDateRange(activeQuery.data.period_start, activeQuery.data.period_end)})`
    : null;

  // Force regenerate - bypasses cache
  const handleForceRegenerate = useCallback(async () => {
    if (!isSupportedPeriod) {
      return;
    }
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
  }, [isSupportedPeriod, mode, period, scope, queryClient]);

  const handleHistorySelect = (item: AISummaryHistoryItem) => {
    setSelectedHistory(item);
    setIsExpanded(false);
    setIsHistoryOpen(false);
  };

  const handleBackToCurrent = () => {
    setSelectedHistory(null);
    setIsExpanded(false);
  };

  // Don't render if AI is unavailable (after health check completes)
  // Moved here after all hooks to satisfy Rules of Hooks
  if (!healthLoading && !isAIAvailable) {
    return null;
  }

  if (!isSupportedPeriod) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            {t("summary.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-sm text-muted-foreground">
            {t("summary.unsupportedPeriod")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-amber-500" />
            {isHistoryView ? (
              <span className="flex items-center gap-2">
                <span className="text-slate-500">{t('summary.pastSummary')}:</span>
                <span>
                  {`${getRelativeLabel(period)} (${formatDateRange(selectedHistory.period_start, selectedHistory.period_end)})`}
                </span>
              </span>
            ) : (
              <>
                <span>{t(period === "weekly" ? "summary.weeklyTitle" : "summary.monthlyTitle")}</span>
                {currentPeriodLabel && (
                  <span className="text-xs font-normal text-slate-500">
                    {currentPeriodLabel}
                  </span>
                )}
              </>
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
                      ) : filteredHistoryItems.length === 0 ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          {t('summary.noHistory')}
                        </div>
                      ) : (
                        filteredHistoryItems.map((item) => (
                          <Button
                            key={item.id}
                            variant="outline"
                            className="w-full justify-start h-auto py-3 text-left"
                            onClick={() => handleHistorySelect(item)}
                          >
                            <div className="flex flex-col gap-1 w-full">
                              <div className="flex items-center gap-2 font-medium">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                {`${getRelativeLabel(period)} (${formatDateRange(item.period_start, item.period_end)})`}
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
                  <WandSparkles
                    className={`w-4 h-4 text-amber-500 ${isLoading ? "animate-pulse" : ""}`}
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
          <UserSummaryContent data={displayData} t={t} isExpanded={isExpanded} onToggleExpanded={() => setIsExpanded(prev => !prev)} />
        ) : (
          <TeamSummaryContent data={displayData} t={t} isExpanded={isExpanded} onToggleExpanded={() => setIsExpanded(prev => !prev)} />
        )}
      </CardContent>
    </Card>
  );
};

interface UserSummaryContentProps {
  data?: {
    summary?: string[];
    focus_areas?: string[];
    workload_observations?: string[];
    risk_signals?: string[];
    record_quality_notes?: string[];
    generated_at: string;
    period_start?: string;
    period_end?: string;
  };
  t: (key: string, options?: Record<string, unknown>) => string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

interface SummarySection {
  key: string;
  label: string;
  items: string[];
  tone?: "default" | "warning" | "muted";
}

const warningTone: SummarySection["tone"] = "warning";
const mutedTone: SummarySection["tone"] = "muted";

function normalizeItems(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function SummarySectionList({
  sections,
  isExpanded,
  onToggleExpanded,
  t,
}: {
  sections: SummarySection[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const previewSectionCount = 2;
  const previewItemCount = 1;
  const visibleSections = isExpanded ? sections : sections.slice(0, previewSectionCount);
  const hasHiddenContent = sections.some((section, sectionIndex) => {
    if (sectionIndex >= previewSectionCount) {
      return true;
    }
    return section.items.length > previewItemCount;
  });

  return (
    <div className="space-y-3 text-sm">
      {visibleSections.map((section) => {
        const visibleItems = isExpanded ? section.items : section.items.slice(0, previewItemCount);
        const toneClasses =
          section.tone === "warning"
            ? "text-amber-700"
            : section.tone === "muted"
              ? "text-slate-600"
              : "text-slate-800";

        return (
          <div key={section.key}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {section.label}
            </p>
            <ul className="space-y-1 pl-1">
              {visibleItems.map((item, index) => (
                <li key={index} className={`flex items-start gap-2 ${toneClasses}`}>
                  <span className="mt-0.5 text-slate-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {hasHiddenContent && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpanded}
          className="h-7 px-2 text-xs"
        >
          {isExpanded ? t("summary.showLess") : t("summary.showMore")}
        </Button>
      )}
    </div>
  );
}

const UserSummaryContent: React.FC<UserSummaryContentProps> = ({ data, t, isExpanded, onToggleExpanded }) => {
  const sections: SummarySection[] = [
    {
      key: "focus",
      label: t("summary.focusAreas"),
      items: normalizeItems(data?.focus_areas).length > 0
        ? normalizeItems(data?.focus_areas)
        : normalizeItems(data?.summary),
    },
    {
      key: "workload",
      label: t("summary.workloadObservations"),
      items: normalizeItems(data?.workload_observations),
    },
    {
      key: "risk",
      label: t("summary.riskSignals"),
      items: normalizeItems(data?.risk_signals),
      tone: warningTone,
    },
    {
      key: "quality",
      label: t("summary.recordQualityNotes"),
      items: normalizeItems(data?.record_quality_notes),
      tone: mutedTone,
    },
  ].filter((section) => section.items.length > 0);

  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('summary.noData')}</p>
    );
  }

  return (
    <SummarySectionList
      sections={sections}
      isExpanded={isExpanded}
      onToggleExpanded={onToggleExpanded}
      t={t}
    />
  );
};

interface TeamSummaryContentProps {
  data?: {
    project_summary?: string[];
    member_summary?: string[];
    issues?: string[];
    analysis?: string[];
    workload_observations?: string[];
    risk_signals?: string[];
    coverage_gaps?: string[];
    record_quality_notes?: string[];
    generated_at: string;
    period_start?: string;
    period_end?: string;
  };
  t: (key: string, options?: Record<string, unknown>) => string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

const TeamSummaryContent: React.FC<TeamSummaryContentProps> = ({
  data,
  t,
  isExpanded,
  onToggleExpanded,
}) => {
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">{t('summary.noData')}</p>
    );
  }

  const sections: SummarySection[] = [
    {
      key: "analysis",
      label: t("summary.analysis"),
      items: normalizeItems(data.analysis).length > 0
        ? normalizeItems(data.analysis)
        : normalizeItems(data.project_summary),
    },
    {
      key: "workload",
      label: t("summary.workloadObservations"),
      items: normalizeItems(data.workload_observations).length > 0
        ? normalizeItems(data.workload_observations)
        : normalizeItems(data.member_summary),
    },
    {
      key: "risk",
      label: t("summary.riskSignals"),
      items: normalizeItems(data.risk_signals).length > 0
        ? normalizeItems(data.risk_signals)
        : normalizeItems(data.issues),
      tone: warningTone,
    },
    {
      key: "coverage",
      label: t("summary.coverageGaps"),
      items: normalizeItems(data.coverage_gaps),
      tone: mutedTone,
    },
    {
      key: "quality",
      label: t("summary.recordQualityNotes"),
      items: normalizeItems(data.record_quality_notes),
      tone: mutedTone,
    },
  ].filter((section) => section.items.length > 0);

  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('summary.noData')}</p>
    );
  }

  return (
    <SummarySectionList
      sections={sections}
      isExpanded={isExpanded}
      onToggleExpanded={onToggleExpanded}
      t={t}
    />
  );
};

export default WeeklySummaryCard;
