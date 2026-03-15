import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./DashboardPage";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useWorklogsTable } from "@/hooks/useWorklogs";
import { useWorkTypeCategories } from "@/hooks/useWorkTypeCategories";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) =>
      (
        {
          "tabs.user": "User",
          "tabs.team": "Team",
          "tabs.project": "Project",
          "viewMode.weekly": "Weekly",
          "viewMode.monthly": "Monthly",
          "viewMode.quarterly": "Quarterly",
          "viewMode.halfYear": "Half Year",
          "viewMode.yearly": "Yearly",
          "cards.projectCount": "Project Count",
          "cards.monthlyAllocation": "Monthly Allocation",
          "labels.itemCount": `${options?.count ?? 0} items`,
          "labels.plannedResources": "Planned resources",
          "status.loading": "Loading",
          "status.loadFailed": "Load failed",
          "status.noData": "No data",
          "status.clickForDetails": "Click for details",
          "cards.weeklyWorkType": "Weekly Work Type",
          "cards.monthlyWorkType": "Monthly Work Type",
          "cards.weeklyProjectWorklog": "Weekly Project Worklog",
          "cards.monthlyProjectWorklog": "Monthly Project Worklog",
          "cards.workTypeRatio": "Work Type Ratio",
          "cards.monthlyTop5Trend": "Top 5 Trend",
          "cards.last12Months": "Last 12 months",
          "labels.back": "Back",
          "labels.detail": "Detail",
          "projectDashboard.comingSoon": "Coming soon",
          "projectDashboard.comingSoonMessage": "Message",
          "projectDashboard.comingSoonSub": "Sub message",
          "common:buttons.today": "Today",
          "common:time.thisWeek": "This week",
          "common:time.thisMonth": "This month",
          "common:messages.nMore": `${options?.count ?? 0} more`,
          "labels.hours": "Hours",
          "labels.others": "Others",
          "labels.monthFormat": `${options?.month ?? ""}M`,
          "labels.yearMonthFormat": `${options?.year ?? ""}-${options?.month ?? ""}`,
          "labels.inputHours": "Hours",
        } as Record<string, string>
      )[key] ?? key,
    i18n: { language: "en" },
  }),
}));

vi.mock("recharts", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    PieChart: passthrough,
    Pie: passthrough,
    Cell: passthrough,
    ResponsiveContainer: passthrough,
    Tooltip: passthrough,
    AreaChart: passthrough,
    Area: passthrough,
    XAxis: passthrough,
    YAxis: passthrough,
    CartesianGrid: passthrough,
    Legend: passthrough,
  };
});

vi.mock("@/hooks/useDashboard", () => ({
  useDashboard: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useWorklogs", () => ({
  useWorklogsTable: vi.fn(),
}));

vi.mock("@/hooks/useWorkTypeCategories", () => ({
  useWorkTypeCategories: vi.fn(),
}));

vi.mock("@/components/dashboard/WeeklySummaryCard", () => ({
  WeeklySummaryCard: ({ mode, period }: { mode: string; period: string }) => (
    <div data-testid={`weekly-summary-${mode}`}>{period}</div>
  ),
}));

vi.mock("@/components/dashboard/MyFTECard", () => ({
  MyFTECard: () => <div data-testid="my-fte-card">my-fte</div>,
}));

vi.mock("@/components/dashboard/UserWeeklyReportCard", () => ({
  UserWeeklyReportCard: ({ referenceDate }: { referenceDate: Date }) => (
    <div data-testid="user-weekly-report-card">{referenceDate.toISOString().slice(0, 10)}</div>
  ),
}));

vi.mock("@/components/dashboard/TeamDashboardContent", () => ({
  TeamDashboardContent: ({
    teamScope,
    selectedOrgId,
  }: {
    teamScope: string;
    selectedOrgId?: string;
  }) => <div data-testid="team-dashboard-content">{teamScope}|{selectedOrgId ?? "none"}</div>,
}));

const mockedUseDashboard = vi.mocked(useDashboard);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseWorklogsTable = vi.mocked(useWorklogsTable);
const mockedUseWorkTypeCategories = vi.mocked(useWorkTypeCategories);

describe("DashboardPage", () => {
  beforeEach(() => {
    mockedUseDashboard.mockReturnValue({
      data: {
        resource_allocation: {
          total_fte: 4.5,
        },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useDashboard>);

    mockedUseAuth.mockReturnValue({
      user: {
        id: "user-1",
        department_id: "DEPT_SW",
        sub_team_id: "SUB_SW",
        division_id: "DIV_SW",
      },
    } as ReturnType<typeof useAuth>);

    mockedUseWorklogsTable.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorklogsTable>);

    mockedUseWorkTypeCategories.mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useWorkTypeCategories>);
  });

  it("shows the personal weekly report card on the user dashboard tab", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("user-weekly-report-card")).not.toHaveTextContent("");
    expect(screen.getByTestId("weekly-summary-user")).toHaveTextContent("weekly");
  });

  it("passes the current team context into the team dashboard tab", () => {
    render(<DashboardPage />);

    const teamTab = screen.getByRole("tab", { name: "Team" });
    fireEvent.mouseDown(teamTab);
    fireEvent.click(teamTab);

    return waitFor(() => {
      expect(screen.getByTestId("team-dashboard-content")).toHaveTextContent("department|DEPT_SW");
    });
  });
});
