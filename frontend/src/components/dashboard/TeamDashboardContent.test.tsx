import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TeamDashboardContent } from "./TeamDashboardContent";
import { useTeamDashboard } from "@/hooks/useDashboard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) =>
      (
        {
          "team.scopeSubTeam": "Sub Team",
          "team.scopeDepartment": "Department",
          "team.scopeBusinessUnit": "Business Unit",
          "team.scopeAll": "All",
          "team.loading": "Loading team dashboard...",
          "team.loadFailed": "Failed to load team dashboard",
          "team.memberCount": `${options?.count ?? 0} members`,
          "team.engineeringRatio": `${options?.percent ?? 0}% of engineering`,
          "team.teamWorklog": "Team Worklog",
          "team.activeProjects": "Active Projects",
          "team.projectCountValue": `${options?.count ?? 0} projects`,
          "team.teamAllocation": "Team Allocation",
          "team.resourcePlan": "resource plan",
          "team.workTypeHours": "Work Type Hours",
          "team.projectRatio": "Project Ratio",
          "team.noProjectData": "No project data",
          "team.selectOrg": "Select team",
          "category.product": "Product",
          "category.functional": "Functional",
          "category.support": "Support",
          "category.team": "Team",
        } as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock("@/hooks/useDashboard", () => ({
  useTeamDashboard: vi.fn(),
}));

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    getDepartments: vi.fn().mockResolvedValue([{ id: "DEPT_SW", name: "Software Department" }]),
    getDivisions: vi.fn().mockResolvedValue([{ id: "DIV_SW", name: "Software Division" }]),
  };
});

vi.mock("./WeeklySummaryCard", () => ({
  WeeklySummaryCard: () => <div data-testid="weekly-summary-card">weekly summary</div>,
}));

vi.mock("./TeamWeeklyReportCard", () => ({
  TeamWeeklyReportCard: ({
    teamScope,
    selectedOrgId,
    teamName,
  }: {
    teamScope: string;
    selectedOrgId?: string;
    teamName: string;
  }) => (
    <div data-testid="team-weekly-report-card">
      {teamScope}|{selectedOrgId ?? "none"}|{teamName}
    </div>
  ),
}));

const mockedUseTeamDashboard = vi.mocked(useTeamDashboard);

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("TeamDashboardContent", () => {
  beforeEach(() => {
    mockedUseTeamDashboard.mockReturnValue(
      {
        data: {
          team_info: {
            name: "Software Department",
            org_path: ["Engineering", "Software"],
            member_count: 7,
          },
          date_range: {
            start: "2026-03-09",
            end: "2026-03-15",
          },
          team_worklogs: {
            total_hours: 120,
            by_project: [],
            by_category: {
              Product: 64,
              Functional: 32,
              Support: 16,
              TeamInternal: 8,
            },
            project_vs_functional: {
              Project: 64,
              Functional: 32,
            },
          },
          member_contributions: [],
          sub_org_contributions: [],
          resource_allocation: {
            active_projects: 3,
            total_planned_fte: 5.5,
            current_month: "2026-03",
          },
          org_context: {
            team_percentage: 22,
          },
        },
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useTeamDashboard>
    );
  });

  it("passes the selected team context into the team weekly report card", async () => {
    renderWithQueryClient(
      <TeamDashboardContent
        teamScope="department"
        setTeamScope={vi.fn()}
        teamViewMode="weekly"
        setTeamViewMode={vi.fn()}
        referenceDate={new Date("2026-03-11")}
        dateRange={{ start: "2026-03-09", end: "2026-03-15" }}
        selectedOrgId="DEPT_SW"
        onOrgChange={vi.fn()}
      />
    );

    expect(await screen.findByTestId("team-weekly-report-card")).toHaveTextContent(
      "department|DEPT_SW|Software Department"
    );
    expect(screen.getByTestId("weekly-summary-card")).toBeInTheDocument();
  });

  it("keeps the scope toggle wired for switching team contexts", async () => {
    const setTeamScope = vi.fn();

    renderWithQueryClient(
      <TeamDashboardContent
        teamScope="department"
        setTeamScope={setTeamScope}
        teamViewMode="weekly"
        setTeamViewMode={vi.fn()}
        referenceDate={new Date("2026-03-11")}
        dateRange={{ start: "2026-03-09", end: "2026-03-15" }}
        selectedOrgId="DEPT_SW"
        onOrgChange={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /Sub Team/i }));

    expect(setTeamScope).toHaveBeenCalledWith("sub_team");
  });
});
