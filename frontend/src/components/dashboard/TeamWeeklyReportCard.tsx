import { useRef, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CalendarDays,
  Eye,
  PencilLine,
  Save,
  Sparkles,
  SquarePen,
  Users,
} from "lucide-react";

import {
  type TeamDashboardScope,
  type WeeklyReportLLMSummaryResponse,
  getApiError,
  generateWeeklyReportLLMSummary,
  getCurrentWeeklyReport,
  getWeeklyReportHistory,
  upsertWeeklyReport,
} from "@/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  applyMarkdownBlockAction,
  WeeklyReportEditorToolbar,
  WeeklyReportMarkdown,
} from "@/components/dashboard/weekly-report-markdown";
import { useAuth } from "@/hooks/useAuth";

interface TeamWeeklyReportCardProps {
  teamScope: TeamDashboardScope;
  selectedOrgId?: string;
  referenceDate: Date;
  teamName: string;
}

function getReferenceDateKey(referenceDate: Date) {
  return format(referenceDate, "yyyy-MM-dd");
}

function formatWeekLabel(weekStart: string, weekEnd: string) {
  return `${weekStart} ~ ${weekEnd}`;
}

function getScopeType(teamScope: TeamDashboardScope) {
  if (teamScope === "department" || teamScope === "sub_team") {
    return teamScope;
  }
  return null;
}

const LLM_SUMMARY_START_MARKER = "<!-- LLM_SUMMARY_START -->";
const LLM_SUMMARY_END_MARKER = "<!-- LLM_SUMMARY_END -->";

function applyLLMSummary(currentBody: string, summaryMarkdown: string): string {
  const startIdx = currentBody.indexOf(LLM_SUMMARY_START_MARKER);
  const endIdx = currentBody.indexOf(LLM_SUMMARY_END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace existing LLM summary block
    const before = currentBody.slice(0, startIdx + LLM_SUMMARY_START_MARKER.length);
    const after = currentBody.slice(endIdx);
    return `${before}\n${summaryMarkdown}\n${after}`;
  }

  // Append new LLM summary block
  const separator = currentBody.trim() ? "\n\n---\n\n" : "";
  return `${currentBody}${separator}${LLM_SUMMARY_START_MARKER}\n${summaryMarkdown}\n${LLM_SUMMARY_END_MARKER}`;
}

export function TeamWeeklyReportCard({
  teamScope,
  selectedOrgId,
  referenceDate,
  teamName,
}: TeamWeeklyReportCardProps) {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [draftBody, setDraftBody] = useState("");
  const [llmMissingWarning, setLlmMissingWarning] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isReadOnly = user?.role === "GUEST" || user?.role === "VIEWER";

  const teamScopeType = getScopeType(teamScope);
  const isSupportedScope = teamScopeType !== null;
  const referenceDateKey = getReferenceDateKey(referenceDate);
  const currentQueryKey = ["weekly-report", "team", teamScope, selectedOrgId ?? "self", referenceDateKey];
  const historyQueryKey = ["weekly-report", "team", "history", teamScope, selectedOrgId ?? "self"];

  const currentQuery = useQuery({
    queryKey: currentQueryKey,
    queryFn: () =>
      getCurrentWeeklyReport({
        scope: "team",
        team_scope_type: teamScopeType ?? undefined,
        scope_id: selectedOrgId,
        reference_date: referenceDateKey,
      }),
    enabled: isSupportedScope,
  });

  const historyQuery = useQuery({
    queryKey: historyQueryKey,
    queryFn: () =>
      getWeeklyReportHistory({
        scope: "team",
        team_scope_type: teamScopeType ?? undefined,
        scope_id: selectedOrgId,
        limit: 4,
      }),
    enabled: isSupportedScope,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertWeeklyReport({
        scope: "team",
        team_scope_type: teamScopeType ?? undefined,
        scope_id: selectedOrgId,
        reference_date: referenceDateKey,
        markdown_body: draftBody,
        status: "published",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: currentQueryKey }),
        queryClient.invalidateQueries({ queryKey: historyQueryKey }),
      ]);
      setIsEditorOpen(false);
    },
  });

  const llmSummaryMutation = useMutation({
    mutationFn: () =>
      generateWeeklyReportLLMSummary({
        team_scope_type: teamScopeType ?? "department",
        scope_id: selectedOrgId ?? "",
        week_start: referenceDateKey,
        save_intermediate: true,
      }),
    onSuccess: (result: WeeklyReportLLMSummaryResponse) => {
      setDraftBody(applyLLMSummary(draftBody, result.team_summary_markdown));
      if (result.missing_members.length > 0) {
        setLlmMissingWarning(
          t("weeklyReport.llmSummaryMissingMembers", {
            members: result.missing_members.join(", "),
          })
        );
      } else {
        setLlmMissingWarning(null);
      }
    },
  });

  const currentData = currentQuery.data;
  const currentReport = currentData?.report ?? null;
  const historyItems = historyQuery.data ?? [];
  const previousReport = historyItems.find((item) => !currentData || item.week_start < currentData.week_start);
  const saveErrorMessage = saveMutation.error ? getApiError(saveMutation.error).message : null;
  const scopeLabel = teamScopeType
    ? t(
        teamScopeType === "department"
          ? "weeklyReport.teamScopeDepartment"
          : "weeklyReport.teamScopeSubTeam"
      )
    : null;

  const handleOpenEditor = () => {
    setDraftBody(currentReport?.markdown_body ?? "");
    setActiveTab("edit");
    setIsEditorOpen(true);
  };

  const handleToolbarAction = (action: Parameters<typeof applyMarkdownBlockAction>[0]["action"]) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const result = applyMarkdownBlockAction({
      value: draftBody,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
      action,
    });

    setDraftBody(result.nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.nextSelectionStart, result.nextSelectionEnd);
    });
  };

  return (
    <>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-teal-600" />
                {t("weeklyReport.teamTitle")}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {scopeLabel ? <Badge variant="secondary">{scopeLabel}</Badge> : null}
                <span>{teamName}</span>
              </div>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                {currentData
                  ? t("weeklyReport.currentWeekLabel", {
                      range: formatWeekLabel(currentData.week_start, currentData.week_end),
                    })
                  : isSupportedScope
                    ? t("weeklyReport.loading")
                    : t("weeklyReport.teamUnsupportedScope")}
              </p>
            </div>

            {isSupportedScope ? (
              <Button
                onClick={handleOpenEditor}
                size="sm"
                className="gap-2"
                disabled={currentQuery.isLoading}
              >
                {currentReport ? <PencilLine className="h-3.5 w-3.5" /> : <SquarePen className="h-3.5 w-3.5" />}
                {currentReport ? t("weeklyReport.edit") : t("weeklyReport.start")}
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {!isSupportedScope ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t("weeklyReport.teamUnsupportedTitle")}</AlertTitle>
              <AlertDescription>{t("weeklyReport.teamUnsupportedBody")}</AlertDescription>
            </Alert>
          ) : currentQuery.isLoading ? (
            <p className="text-sm text-slate-500">{t("weeklyReport.loading")}</p>
          ) : currentQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>{t("weeklyReport.loadFailedTitle")}</AlertTitle>
              <AlertDescription>
                {getApiError(currentQuery.error).message || t("weeklyReport.loadFailedBody")}
              </AlertDescription>
            </Alert>
          ) : currentReport ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="secondary">
                  {currentReport.status === "published"
                    ? t("weeklyReport.statusPublished")
                    : t("weeklyReport.statusDraft")}
                </Badge>
                <span>{t("weeklyReport.lastUpdated", { date: currentReport.updated_at.slice(0, 10) })}</span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <WeeklyReportMarkdown
                  value={currentReport.markdown_body}
                  emptyMessage={t("weeklyReport.previewEmpty")}
                  compact
                />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">{t("weeklyReport.teamEmptyTitle")}</p>
            </div>
          )}

          {isSupportedScope && historyItems.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                {t("weeklyReport.recent")}
              </div>
              <div className="space-y-2">
                {historyItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium text-slate-700">{formatWeekLabel(item.week_start, item.week_end)}</div>
                    </div>
                    {currentReport?.id === item.id ? (
                      <Badge variant="secondary">{t("weeklyReport.currentBadge")}</Badge>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("weeklyReport.teamEditorTitle")}</DialogTitle>
            <DialogDescription className="sr-only">
              {currentData
                ? t("weeklyReport.currentWeekLabel", {
                    range: formatWeekLabel(currentData.week_start, currentData.week_end),
                  })
                : t("weeklyReport.loading")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {scopeLabel ? <Badge variant="secondary">{scopeLabel}</Badge> : null}
              <span>{teamName}</span>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "edit" | "preview")}>
              <TabsList>
                <TabsTrigger value="edit" className="gap-2">
                  <SquarePen className="h-3.5 w-3.5" />
                  {t("weeklyReport.tabEdit")}
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-2">
                  <Eye className="h-3.5 w-3.5" />
                  {t("weeklyReport.tabPreview")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <WeeklyReportEditorToolbar onAction={handleToolbarAction} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setLlmMissingWarning(null);
                        llmSummaryMutation.mutate();
                      }}
                      disabled={isReadOnly || llmSummaryMutation.isPending || !teamScopeType || !selectedOrgId}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {llmSummaryMutation.isPending
                        ? t("weeklyReport.llmSummaryGenerating")
                        : t("weeklyReport.llmSummaryButton")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDraftBody(previousReport?.markdown_body ?? "")}
                      disabled={!previousReport}
                    >
                      {t("weeklyReport.copyPrevious")}
                    </Button>
                  </div>
                </div>
                {llmMissingWarning ? (
                  <Alert className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{llmMissingWarning}</AlertDescription>
                  </Alert>
                ) : null}
                {llmSummaryMutation.isError ? (
                  <Alert variant="destructive" className="mt-3">
                    <AlertTitle>{t("weeklyReport.saveFailedTitle")}</AlertTitle>
                    <AlertDescription>
                      {getApiError(llmSummaryMutation.error).message}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <label htmlFor="team-weekly-report-body" className="sr-only">
                  {t("weeklyReport.tabEdit")}
                </label>
                <Textarea
                  id="team-weekly-report-body"
                  ref={textareaRef}
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  placeholder={t("weeklyReport.teamEditorPlaceholder")}
                  className="mt-3 min-h-[360px] resize-y font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <div className="min-h-[360px] rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <WeeklyReportMarkdown value={draftBody} emptyMessage={t("weeklyReport.previewEmpty")} />
                </div>
              </TabsContent>
            </Tabs>

            {saveErrorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>{t("weeklyReport.saveFailedTitle")}</AlertTitle>
                <AlertDescription>{saveErrorMessage}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
                {t("weeklyReport.cancel")}
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="gap-2"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? t("weeklyReport.saving") : t("weeklyReport.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
