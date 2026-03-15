import { useState } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

interface UserWeeklyReportCardProps {
  referenceDate: Date;
}

function getReferenceDateKey(referenceDate: Date) {
  return format(referenceDate, "yyyy-MM-dd");
}

function formatWeekLabel(weekStart: string, weekEnd: string) {
  return `${weekStart} ~ ${weekEnd}`;
}

function getFallbackTitle(referenceDate: Date) {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
  return `${format(weekStart, "yyyy-MM-dd")} ~ ${format(weekEnd, "yyyy-MM-dd")}`;
}

export function UserWeeklyReportCard({ referenceDate }: UserWeeklyReportCardProps) {
  const { t } = useTranslation("dashboard");
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");

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
        title: draftTitle.trim() || undefined,
        markdown_body: draftBody,
        status: "draft",
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
  const displayTitle =
    currentReport?.title || t("weeklyReport.defaultTitle", { range: getFallbackTitle(referenceDate) });

  const handleOpenEditor = () => {
    setDraftTitle(currentReport?.title ?? "");
    setDraftBody(currentReport?.markdown_body ?? "");
    setActiveTab("edit");
    setIsEditorOpen(true);
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
                <span>{displayTitle}</span>
                <span>{t("weeklyReport.lastUpdated", { date: currentReport.updated_at.slice(0, 10) })}</span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {currentReport.markdown_body}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              <p className="font-medium text-slate-800">{t("weeklyReport.emptyTitle")}</p>
              <p className="mt-1">{t("weeklyReport.emptyBody")}</p>
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
                      <div className="font-medium text-slate-700">
                        {item.title || t("weeklyReport.defaultTitle", { range: formatWeekLabel(item.week_start, item.week_end) })}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatWeekLabel(item.week_start, item.week_end)}
                      </div>
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
            <DialogDescription>
              {currentData
                ? t("weeklyReport.editorDescription", {
                    range: formatWeekLabel(currentData.week_start, currentData.week_end),
                  })
                : t("weeklyReport.loading")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="weekly-report-title" className="text-sm font-medium text-slate-700">
                {t("weeklyReport.reportTitleLabel")}
              </label>
              <input
                id="weekly-report-title"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder={t("weeklyReport.reportTitlePlaceholder")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
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
                <label htmlFor="weekly-report-body" className="sr-only">
                  {t("weeklyReport.tabEdit")}
                </label>
                <Textarea
                  id="weekly-report-body"
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  placeholder={t("weeklyReport.editorPlaceholder")}
                  className="min-h-[360px] resize-y font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <div className="min-h-[360px] rounded-lg border border-slate-200 bg-slate-50 p-5">
                  {draftBody.trim() ? (
                    <div className="space-y-4 text-sm leading-7 text-slate-700 [&_a]:text-blue-600 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-slate-200 [&_code]:px-1 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:text-slate-700 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-slate-100">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{draftBody}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
                      {t("weeklyReport.previewEmpty")}
                    </div>
                  )}
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
              <p className="text-xs text-slate-500">{t("weeklyReport.saveHint")}</p>
              <div className="flex items-center gap-2">
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
