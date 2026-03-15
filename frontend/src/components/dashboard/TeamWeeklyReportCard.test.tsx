import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TeamWeeklyReportCard } from "./TeamWeeklyReportCard";
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
          "weeklyReport.teamTitle": "Team Weekly Report",
          "weeklyReport.teamDefaultTitle": `${options?.team ?? ""} Weekly Report`,
          "weeklyReport.currentWeekLabel": `Current report week: ${options?.range ?? ""}`,
          "weeklyReport.loading": "Loading weekly report...",
          "weeklyReport.loadFailedTitle": "Failed to load weekly report",
          "weeklyReport.loadFailedBody": "Please try again in a moment.",
          "weeklyReport.statusDraft": "Draft",
          "weeklyReport.statusPublished": "Published",
          "weeklyReport.lastUpdated": `Last updated ${options?.date ?? ""}`,
          "weeklyReport.start": "Start report",
          "weeklyReport.edit": "Edit report",
          "weeklyReport.recent": "Recent Reports",
          "weeklyReport.currentBadge": "Current",
          "weeklyReport.teamEditorTitle": "Edit Team Weekly Report",
          "weeklyReport.teamEditorDescription": `Write and save the ${options?.scope ?? ""} report for ${options?.team ?? ""} (${options?.range ?? ""}).`,
          "weeklyReport.reportTitleLabel": "Report Title",
          "weeklyReport.teamTitlePlaceholder": `Optional title for ${options?.team ?? ""}`,
          "weeklyReport.tabEdit": "Edit",
          "weeklyReport.tabPreview": "Preview",
          "weeklyReport.teamEditorPlaceholder": "placeholder",
          "weeklyReport.previewEmpty": "Your Markdown preview will appear here.",
          "weeklyReport.saveHint": "Images and file attachments are not included in v1.",
          "weeklyReport.cancel": "Cancel",
          "weeklyReport.save": "Save draft",
          "weeklyReport.saving": "Saving...",
          "weeklyReport.saveFailedTitle": "Failed to save weekly report",
          "weeklyReport.teamEmptyTitle": "No team weekly report for this week yet.",
          "weeklyReport.teamEmptyBody": "Capture cross-team highlights, blockers, and next steps for this department or sub-team.",
          "weeklyReport.teamScopeDepartment": "Department",
          "weeklyReport.teamScopeSubTeam": "Sub-Team",
          "weeklyReport.teamUnsupportedTitle": "Weekly reports are not available for this scope",
          "weeklyReport.teamUnsupportedBody": "Team weekly reports currently support department and sub-team views only.",
          "weeklyReport.teamUnsupportedScope": "This scope is not supported for weekly reports.",
          "weeklyReport.delegationTitle": "Delegated writing supported",
          "weeklyReport.delegationBody": "Any member in this scope can update the shared report when the lead is unavailable.",
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

describe("TeamWeeklyReportCard", () => {
  beforeEach(() => {
    mockedGetCurrentWeeklyReport.mockResolvedValue({
      scope: "team",
      team_scope_type: "department",
      scope_id: "DEPT_TEST",
      target_key: "department:DEPT_TEST",
      week_start: "2026-03-09",
      week_end: "2026-03-15",
      week_key: "2026-W11",
      is_in_progress: true,
      report: null,
    });
    mockedGetWeeklyReportHistory.mockResolvedValue([]);
    mockedUpsertWeeklyReport.mockResolvedValue({
      id: "team-report-1",
      scope: "team",
      team_scope_type: "department",
      scope_id: "DEPT_TEST",
      target_key: "department:DEPT_TEST",
      week_start: "2026-03-09",
      week_end: "2026-03-15",
      week_key: "2026-W11",
      is_in_progress: true,
      status: "draft",
      title: "Software Weekly Report",
      markdown_body: "## Team Highlights",
      source_metadata: null,
      owner_user_id: null,
      created_by_user_id: "user-1",
      updated_by_user_id: "user-1",
      published_by_user_id: null,
      published_at: null,
      created_at: "2026-03-12T09:00:00Z",
      updated_at: "2026-03-12T09:00:00Z",
    });
  });

  it("shows an informational state for unsupported scopes", async () => {
    renderWithQueryClient(
      <TeamWeeklyReportCard
        teamScope="business_unit"
        referenceDate={new Date("2026-03-11")}
        teamName="Engineering"
      />
    );

    expect(await screen.findByText("Team Weekly Report")).toBeInTheDocument();
    expect(screen.getByText("Weekly reports are not available for this scope")).toBeInTheDocument();
    expect(mockedGetCurrentWeeklyReport).not.toHaveBeenCalled();
  });

  it("saves a department weekly report draft", async () => {
    renderWithQueryClient(
      <TeamWeeklyReportCard
        teamScope="department"
        selectedOrgId="DEPT_TEST"
        referenceDate={new Date("2026-03-11")}
        teamName="Software Team"
      />
    );

    await screen.findByText("Team Weekly Report");
    await userEvent.click(screen.getByRole("button", { name: "Start report" }));

    await userEvent.type(screen.getByLabelText("Report Title"), "Software Weekly Report");
    await userEvent.type(screen.getByLabelText("Edit", { selector: "textarea" }), "## Team Highlights");
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(mockedUpsertWeeklyReport).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "team",
          team_scope_type: "department",
          scope_id: "DEPT_TEST",
          reference_date: "2026-03-11",
          title: "Software Weekly Report",
          markdown_body: "## Team Highlights",
          status: "draft",
        })
      );
    });
  });
});
