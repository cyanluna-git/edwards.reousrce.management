import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserWeeklyReportCard } from "./UserWeeklyReportCard";
import {
  getCurrentWeeklyReport,
  getWeeklyReportHistory,
  upsertWeeklyReport,
} from "@/api/client";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      (
        {
          "weeklyReport.title": "Weekly Report",
          "weeklyReport.currentWeekLabel": `Current report week: ${options?.range ?? ""}`,
          "weeklyReport.loading": "Loading weekly report...",
          "weeklyReport.loadFailedTitle": "Failed to load weekly report",
          "weeklyReport.loadFailedBody": "Please try again in a moment.",
          "weeklyReport.statusDraft": "Draft",
          "weeklyReport.statusPublished": "Published",
          "weeklyReport.lastUpdated": `Last updated ${options?.date ?? ""}`,
          "weeklyReport.start": "Start report",
          "weeklyReport.edit": "Edit report",
          "weeklyReport.emptyTitle": "No weekly report for this week yet.",
          "weeklyReport.recent": "Recent Reports",
          "weeklyReport.currentBadge": "Current",
          "weeklyReport.editorTitle": "Edit Weekly Report",
          "weeklyReport.tabEdit": "Edit",
          "weeklyReport.tabPreview": "Preview",
          "weeklyReport.copyPrevious": "Copy last week",
          "weeklyReport.editorPlaceholder": "placeholder",
          "weeklyReport.previewEmpty": "Your Markdown preview will appear here.",
          "weeklyReport.cancel": "Cancel",
          "weeklyReport.save": "Save draft",
          "weeklyReport.saving": "Saving...",
          "weeklyReport.saveFailedTitle": "Failed to save weekly report",
        } as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    getCurrentWeeklyReport: vi.fn(),
    getWeeklyReportHistory: vi.fn(),
    upsertWeeklyReport: vi.fn(),
  };
});

const mockedGetCurrentWeeklyReport = vi.mocked(getCurrentWeeklyReport);
const mockedGetWeeklyReportHistory = vi.mocked(getWeeklyReportHistory);
const mockedUpsertWeeklyReport = vi.mocked(upsertWeeklyReport);

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("UserWeeklyReportCard", () => {
  beforeEach(() => {
    mockedGetCurrentWeeklyReport.mockResolvedValue({
      scope: "user",
      team_scope_type: null,
      scope_id: "user-1",
      target_key: "user:user-1",
      week_start: "2026-03-09",
      week_end: "2026-03-15",
      week_key: "2026-W11",
      is_in_progress: true,
      report: null,
    });
    mockedGetWeeklyReportHistory.mockResolvedValue([
      {
        id: "report-prev",
        scope: "user",
        team_scope_type: null,
        scope_id: "user-1",
        target_key: "user:user-1",
        week_start: "2026-03-02",
        week_end: "2026-03-08",
        week_key: "2026-W10",
        is_in_progress: false,
        status: "draft",
        title: null,
        markdown_body: "## Previous Highlights",
        source_metadata: null,
        owner_user_id: "user-1",
        created_by_user_id: "user-1",
        updated_by_user_id: "user-1",
        published_by_user_id: null,
        published_at: null,
        created_at: "2026-03-08T09:00:00Z",
        updated_at: "2026-03-08T09:00:00Z",
      },
    ]);
    mockedUpsertWeeklyReport.mockResolvedValue({
      id: "report-1",
      scope: "user",
      team_scope_type: null,
      scope_id: "user-1",
      target_key: "user:user-1",
      week_start: "2026-03-09",
      week_end: "2026-03-15",
      week_key: "2026-W11",
      is_in_progress: true,
      status: "draft",
      title: null,
      markdown_body: "## Highlights",
      source_metadata: null,
      owner_user_id: "user-1",
      created_by_user_id: "user-1",
      updated_by_user_id: "user-1",
      published_by_user_id: null,
      published_at: null,
      created_at: "2026-03-12T09:00:00Z",
      updated_at: "2026-03-12T09:00:00Z",
    });
  });

  it("renders the empty state and opens the editor", async () => {
    renderWithQueryClient(<UserWeeklyReportCard referenceDate={new Date("2026-03-11")} />);

    expect(await screen.findByText("Weekly Report")).toBeInTheDocument();
    expect(await screen.findByText("No weekly report for this week yet.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Start report" }));

    expect(screen.getByText("Edit Weekly Report")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Preview" })).toBeInTheDocument();
  });

  it("saves the current weekly report draft through the API", async () => {
    renderWithQueryClient(<UserWeeklyReportCard referenceDate={new Date("2026-03-11")} />);

    await screen.findByText("Weekly Report");
    await userEvent.click(screen.getByRole("button", { name: "Start report" }));

    await userEvent.click(screen.getByRole("button", { name: "H3" }));
    await userEvent.type(screen.getByLabelText("Edit", { selector: "textarea" }), "## Highlights");
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(mockedUpsertWeeklyReport).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "user",
          reference_date: "2026-03-11",
          markdown_body: "### ## Highlights",
          status: "draft",
        })
      );
    });
  });

  it("copies the previous weekly report body into the editor", async () => {
    renderWithQueryClient(<UserWeeklyReportCard referenceDate={new Date("2026-03-11")} />);

    await screen.findByText("Weekly Report");
    await userEvent.click(screen.getByRole("button", { name: "Start report" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy last week" }));

    expect(screen.getByLabelText("Edit", { selector: "textarea" })).toHaveValue("## Previous Highlights");
  });
});
