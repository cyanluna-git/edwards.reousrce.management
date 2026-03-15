import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { LanguageToggle } from "@/components/LanguageToggle";
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  Calendar,
  BarChart3,
  Settings,
  Building2,
  LogOut,
  Shield,
  Eye,
  PenSquare,
  MessageSquare,
  Grid3x3,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";

// Nav item definition with i18n key
interface NavItem {
  nameKey: string;
  href: string;
  icon: any;
}

// Monitoring - View/Analysis
const monitoringNavigation: NavItem[] = [
  { nameKey: "main.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { nameKey: "main.resourceMatrix", href: "/resource-matrix", icon: Grid3x3 },
  { nameKey: "main.reports", href: "/reports", icon: BarChart3 },
];

// Entry - Data Input
const entryNavigation: NavItem[] = [
  { nameKey: "main.worklogs", href: "/worklogs", icon: Clock },
  { nameKey: "main.resourcePlans", href: "/resource-plans", icon: Calendar },
];

// Admin settings (requires special permissions)
const adminNavigation: NavItem[] = [
  { nameKey: "main.projects", href: "/projects", icon: FolderKanban },
  { nameKey: "main.organization", href: "/organization", icon: Building2 },
  { nameKey: "main.settings", href: "/settings", icon: Settings },
];

const requestBoardLink: NavItem = {
  nameKey: "main.requestBoard",
  href: "/requests",
  icon: MessageSquare,
};

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useTranslation("navigation");

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.href;
    const name = t(item.nameKey);
    return (
      <Link
        key={item.nameKey}
        to={item.href}
        title={isCollapsed ? name : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-blue-600 text-white"
            : "text-slate-300 hover:bg-slate-800 hover:text-white",
          isCollapsed && "justify-center px-2",
        )}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && <span>{name}</span>}
      </Link>
    );
  };

  const renderSection = (
    title: string,
    icon: React.ElementType,
    items: NavItem[],
    showDivider = false,
  ) => (
    <div className={showDivider ? "pt-2" : ""}>
      {showDivider && <div className="mb-2 border-t border-slate-700" />}
      {!isCollapsed && (
        <div className="mb-1.5 flex items-center gap-2 px-3">
          {React.createElement(icon, { className: "h-4 w-4 text-slate-500" })}
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </span>
        </div>
      )}
      {isCollapsed && showDivider && (
        <div className="mb-2 flex justify-center">
          {React.createElement(icon, { className: "h-4 w-4 text-slate-500" })}
        </div>
      )}
      <div className="space-y-0.5">{items.map(renderNavItem)}</div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-slate-900 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo & Toggle */}
      <div className="relative flex min-h-32 items-start justify-between px-3 pt-3">
        <div className={cn("flex items-start gap-2", isCollapsed && "justify-center w-full")}>
          {isCollapsed && (
            <div className="flex flex-col items-center justify-center text-blue-400">
              <span className="text-base font-black leading-none">E</span>
              <span className="text-base font-black leading-none">O</span>
              <span className="text-base font-black leading-none">B</span>
            </div>
          )}
          {!isCollapsed && (
            <div className="flex min-w-0 flex-1 flex-col items-start pr-8 text-left">
              <img
                src="/branding/edwards-logo.svg"
                alt="Edwards"
                className="h-9 w-auto object-contain"
              />
              <div className="mt-1 ml-1.5 leading-tight text-[#dbe4ee]">
                <p className="text-[1.02rem] font-semibold tracking-tight">Engineering</p>
                <p className="text-[1.02rem] font-semibold tracking-tight">Operation Board</p>
              </div>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button
            onClick={onToggle}
            className="absolute right-3 top-3 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            title={t("sidebar.collapse")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Greeting - moved from header */}
      <div className={cn("border-b border-slate-700 px-3 py-2", isCollapsed && "px-2")}>
        {isCollapsed ? (
          <div className="flex justify-center">
            <span className="text-lg">👋</span>
          </div>
        ) : (
          <div className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-2">
            <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
              <span className="text-base leading-none">👋</span>
              <span className="truncate">
                {t("sidebar.welcome")} {user?.name || user?.korean_name || t("sidebar.guest")}!
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Collapsed toggle button */}
      {isCollapsed && (
        <div className="px-2 py-2">
          <button
            onClick={onToggle}
            className="w-full p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex justify-center"
            title={t("sidebar.expand")}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3 overflow-y-auto">
        {/* Monitoring Section */}
        {renderSection(t("sections.monitoring"), Eye, monitoringNavigation)}

        {/* Entry Section */}
        {renderSection(t("sections.entry"), PenSquare, entryNavigation, true)}

        {/* Admin Settings Section */}
        {renderSection(t("sections.adminSettings"), Shield, adminNavigation, true)}
      </nav>

      <div className={cn("px-2 pb-3", isCollapsed && "pb-2")}>
        {isCollapsed ? (
          <div className="space-y-1">
            <Link
              to="/portal"
              title="Portal"
              className={cn(
                "flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white",
                location.pathname.startsWith("/portal") && "bg-slate-800 text-white",
              )}
            >
              <Grid3x3 className="h-5 w-5 flex-shrink-0" />
            </Link>
            {renderNavItem(requestBoardLink)}
            <Link
              to="/updates"
              title={t("sidebar.updateHistory")}
              className={cn(
                "flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white",
                location.pathname === "/updates" && "bg-slate-800 text-white",
              )}
            >
              <History className="h-5 w-5 flex-shrink-0" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/portal"
              title="Portal"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white",
                location.pathname.startsWith("/portal") && "bg-slate-800 text-white",
              )}
            >
              <Grid3x3 className="h-4.5 w-4.5" />
            </Link>
            <Link
              to={requestBoardLink.href}
              title={t(requestBoardLink.nameKey)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white",
                location.pathname === requestBoardLink.href && "bg-slate-800 text-white",
              )}
            >
              <MessageSquare className="h-4.5 w-4.5" />
            </Link>
            <Link
              to="/updates"
              title={t("sidebar.updateHistory")}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white",
                location.pathname === "/updates" && "bg-slate-800 text-white",
              )}
            >
              <History className="h-4.5 w-4.5" />
            </Link>
            <div className="min-w-0 flex-1">
              <LanguageToggle variant="collapsed" />
            </div>
          </div>
        )}
      </div>

      {/* Language Toggle */}
      {isCollapsed && (
        <div className="border-t border-slate-700 px-2 py-2">
          <LanguageToggle variant="collapsed" />
        </div>
      )}

      {/* User info & Logout */}
      <div className={cn("border-t border-slate-700 p-3 space-y-3", isCollapsed && "p-2")}>
        {isCollapsed ? (
          <>
            <div className="flex justify-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700">
                <span className="text-sm font-medium text-white">
                  {user?.korean_name?.[0] || user?.name?.[0] || "U"}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title={t("sidebar.logout")}
              className="flex w-full items-center justify-center gap-2 rounded-lg p-2 text-sm font-medium text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => navigate("/profile")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 flex-shrink-0">
                <span className="text-sm font-medium text-white">
                  {user?.korean_name?.[0] || user?.name?.[0] || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate text-sm font-medium text-white">
                  {user?.korean_name || user?.name || "User"}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {user?.email || "user@edwards.com"}
                </p>
              </div>
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t("sidebar.logout")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
