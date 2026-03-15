import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WeeklySummaryCard from "./WeeklySummaryCard";
import {
  getTeamAISummary,
  getTeamAISummaryHistory,
  getUserAISummary,
  getUserAISummaryHistory,
} from "@/api/client";
import { useAIHealth } from "@/hooks/useAIWorklog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        {
          "summary.title": "AI Summary",
          "summary.weeklyTitle": "Weekly Summary",
          "summary.monthlyTitle": "Monthly Summary",
          "summary.lastWeek": "Last week",
          "summary.lastMonth": "Last month",
          "summary.unsupportedPeriod": "AI summaries are currently available for last week and last month only.",
          "summary.analysis": "Analysis",
          "summary.workloadObservations": "Workload observations",
          "summary.riskSignals": "Risk signals",
          "summary.coverageGaps": "Coverage gaps",
          "summary.recordQualityNotes": "Record quality notes",
          "summary.focusAreas": "Focus areas",
          "summary.showMore": "Show more",
          "summary.showLess": "Show less",
          "summary.noData": "No data available",
          "summary.viewPastSummary": "View past summary",
          "summary.historyTitle": "Summary history",
          "summary.historyLoading": "Loading history",
          "summary.noHistory": "No history",
          "summary.generatedAt": "Generated at",
          "summary.historyBadge": "History",
          "summary.cacheBadge": "Cached",
          "summary.backToCurrent": "Back to current",
          "summary.pastSummary": "Past summary",
          "summary.regenerate": "Regenerate",
          "summary.error": "Error",
        } as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock("@/api/client", () => ({
  getUserAISummary: vi.fn(),
  getTeamAISummary: vi.fn(),
  getUserAISummaryHistory: vi.fn(),
  getTeamAISummaryHistory: vi.fn(),
}));

vi.mock("@/hooks/useAIWorklog", () => ({
  useAIHealth: vi.fn(),
}));

const mockedUseAIHealth = vi.mocked(useAIHealth);
const mockedGetUserAISummary = vi.mocked(getUserAISummary);
const mockedGetTeamAISummary = vi.mocked(getTeamAISummary);
const mockedGetUserAISummaryHistory = vi.mocked(getUserAISummaryHistory);
const mockedGetTeamAISummaryHistory = vi.mocked(getTeamAISummaryHistory);

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("WeeklySummaryCard", () => {
  beforeEach(() => {
    mockedUseAIHealth.mockReturnValue({
      data: { status: "healthy" },
      isLoading: false,
    } as unknown as ReturnType<typeof useAIHealth>);

    mockedGetUserAISummary.mockResolvedValue({
      summary: [],
      period_start: "2026-03-02",
      period_end: "2026-03-08",
      generated_at: "2026-03-09T09:00:00Z",
    });
    mockedGetTeamAISummary.mockResolvedValue({
      project_summary: [],
      member_summary: [],
      issues: [],
      period_start: "2026-03-02",
      period_end: "2026-03-08",
      generated_at: "2026-03-09T09:00:00Z",
    });
    mockedGetUserAISummaryHistory.mockResolvedValue([]);
    mockedGetTeamAISummaryHistory.mockResolvedValue([]);
  });

  it("shows an unsupported message for quarterly and yearly dashboard periods", () => {
    renderWithQueryClient(<WeeklySummaryCard mode="team" period="quarterly" />);

    expect(screen.getByText("AI Summary")).toBeInTheDocument();
    expect(
      screen.getByText("AI summaries are currently available for last week and last month only.")
    ).toBeInTheDocument();
    expect(mockedGetTeamAISummary).not.toHaveBeenCalled();
  });

  it("renders team sections in preview mode and expands hidden content on demand", async () => {
    mockedGetTeamAISummary.mockResolvedValue({
      analysis: ["Project A absorbed most team focus.", "Support demand remained elevated."],
      workload_observations: ["Two engineers carried the highest share.", "Workload was uneven across the team."],
      risk_signals: ["Documentation coverage is still thin."],
      coverage_gaps: ["Milestone updates were missing in several logs."],
      record_quality_notes: ["Descriptions were short for support work."],
      project_summary: [],
      member_summary: [],
      issues: [],
      period_start: "2026-03-02",
      period_end: "2026-03-08",
      generated_at: "2026-03-09T09:00:00Z",
    });

    renderWithQueryClient(<WeeklySummaryCard mode="team" period="weekly" />);

    expect(await screen.findByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Project A absorbed most team focus.")).toBeInTheDocument();
    expect(screen.getByText("Workload observations")).toBeInTheDocument();
    expect(screen.getByText("Two engineers carried the highest share.")).toBeInTheDocument();
    expect(screen.queryByText("Risk signals")).not.toBeInTheDocument();
    expect(screen.queryByText("Support demand remained elevated.")).not.toBeInTheDocument();

    const showMoreButton = screen.getByRole("button", { name: "Show more" });
    await userEvent.click(showMoreButton);

    expect(screen.getByText("Risk signals")).toBeInTheDocument();
    expect(screen.getByText("Support demand remained elevated.")).toBeInTheDocument();
    expect(screen.getByText("Documentation coverage is still thin.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();

    const analysisHeading = screen.getByText("Analysis");
    const workloadHeading = screen.getByText("Workload observations");
    const riskHeading = screen.getByText("Risk signals");

    expect(
      analysisHeading.compareDocumentPosition(workloadHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      workloadHeading.compareDocumentPosition(riskHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("falls back to legacy team summary fields when the new schema is absent", async () => {
    mockedGetTeamAISummary.mockResolvedValue({
      project_summary: ["Legacy project insight"],
      member_summary: ["Legacy member insight"],
      issues: ["Legacy risk insight"],
      period_start: "2026-03-02",
      period_end: "2026-03-08",
      generated_at: "2026-03-09T09:00:00Z",
    });

    renderWithQueryClient(<WeeklySummaryCard mode="team" period="weekly" />);

    expect(await screen.findByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Legacy project insight")).toBeInTheDocument();
    expect(screen.getByText("Workload observations")).toBeInTheDocument();
    expect(screen.getByText("Legacy member insight")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show more" }));

    expect(screen.getByText("Risk signals")).toBeInTheDocument();
    expect(screen.getByText("Legacy risk insight")).toBeInTheDocument();
  });

  it("shows only matching history entries for the active summary period", async () => {
    mockedGetTeamAISummary.mockResolvedValue({
      analysis: ["Current weekly analysis"],
      project_summary: [],
      member_summary: [],
      issues: [],
      period_start: "2026-03-02",
      period_end: "2026-03-08",
      generated_at: "2026-03-09T09:00:00Z",
    });
    mockedGetTeamAISummaryHistory.mockResolvedValue([
      {
        id: "weekly-1",
        period_start: "2026-03-02",
        period_end: "2026-03-08",
        summary: { analysis: ["Weekly history item"] },
        generated_at: "2026-03-09T09:00:00Z",
      },
      {
        id: "monthly-1",
        period_start: "2026-02-01",
        period_end: "2026-02-28",
        summary: { analysis: ["Monthly history item"] },
        generated_at: "2026-03-01T09:00:00Z",
      },
    ]);

    renderWithQueryClient(<WeeklySummaryCard mode="team" period="weekly" />);

    await screen.findByText("Analysis");
    await userEvent.click(screen.getByTitle("View past summary"));

    expect(await screen.findByText("Summary history")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(/Last week \(/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Last month \(/)).not.toBeInTheDocument();
  });
});
