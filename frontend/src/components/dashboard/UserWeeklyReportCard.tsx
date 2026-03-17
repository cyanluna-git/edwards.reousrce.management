import { useRef, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Eye,
  FileText,
  PencilLine,
  Save,
  SquarePen,
} from "lucide-react";

import {
  getApiError,
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

interface UserWeeklyReportCardProps {
  referenceDate: Date;
}

function getReferenceDateKey(referenceDate: Date) {
  return format(referenceDate, "yyyy-MM-dd");
}

function formatWeekLabel(weekStart: string, weekEnd: string) {
  return `${weekStart} ~ ${weekEnd}`;
}

export function UserWeeklyReportCard({ referenceDate }: UserWeeklyReportCardProps) {
  const { t } = useTranslation("dashboard");
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [draftBody, setDraftBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const referenceDateKey = getReferenceDateKey(referenceDate);

  const currentQuery = useQuery({
    queryKey: ["weekly-report", "user", "current", referenceDateKey],
    queryFn: () =>
      getCurrentWeeklyReport({
        scope: "user",
        reference_date: referenceDateKey,
      }),
  });

  const historyQuery = useQuery({
    queryKey: ["weekly-report", "user", "history"],
    queryFn: () =>
      getWeeklyReportHistory({
        scope: "user",
        limit: 4,
      }),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertWeeklyReport({
        scope: "user",
        reference_date: referenceDateKey,
        markdown_body: draftBody,
        status: "published",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["weekly-report", "user", "current", referenceDateKey] }),
        queryClient.invalidateQueries({ queryKey: ["weekly-report", "user", "history"] }),
      ]);
      setIsEditorOpen(false);
    },
  });

  const currentData = currentQuery.data;
  const currentReport = currentData?.report ?? null;
  const historyItems = historyQuery.data ?? [];
  const previousReport = historyItems.find((item) => !currentData || item.week_start < currentData.week_start);

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

  const saveErrorMessage = saveMutation.error ? getApiError(saveMutation.error).message : null;

  return (
    <>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-emerald-600" />
                {t("weeklyReport.title")}
              </CardTitle>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                {currentData
                  ? t("weeklyReport.currentWeekLabel", {
                      range: formatWeekLabel(currentData.week_start, currentData.week_end),
                    })
                  : t("weeklyReport.loading")}
              </p>
            </div>

            <Button
              onClick={handleOpenEditor}
              size="sm"
              className="gap-2"
              disabled={currentQuery.isLoading}
            >
              {currentReport ? <PencilLine className="h-3.5 w-3.5" /> : <SquarePen className="h-3.5 w-3.5" />}
              {currentReport ? t("weeklyReport.edit") : t("weeklyReport.start")}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {currentQuery.isLoading ? (
            <p className="text-sm text-slate-500">{t("weeklyReport.loading")}</p>
          ) : currentQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>{t("weeklyReport.loadFailedTitle")}</AlertTitle>
              <AlertDescription>{t("weeklyReport.loadFailedBody")}</AlertDescription>
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
              <p className="font-medium text-slate-800">{t("weeklyReport.emptyTitle")}</p>
            </div>
          )}

          {historyItems.length > 0 && (
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
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("weeklyReport.editorTitle")}</DialogTitle>
            <DialogDescription className="sr-only">
              {currentData
                ? t("weeklyReport.currentWeekLabel", {
                    range: formatWeekLabel(currentData.week_start, currentData.week_end),
                  })
                : t("weeklyReport.loading")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                <label htmlFor="weekly-report-body" className="sr-only">
                  {t("weeklyReport.tabEdit")}
                </label>
                <Textarea
                  id="weekly-report-body"
                  ref={textareaRef}
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  placeholder={t("weeklyReport.editorPlaceholder")}
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
