import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
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
} from 'lucide-react'

// Monitoring - View/Analysis
const monitoringNavigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Resource Matrix', href: '/resource-matrix', icon: Grid3x3 },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
]

// Entry - Data Input
const entryNavigation = [
    { name: 'WorkLogs', href: '/worklogs', icon: Clock },
    { name: 'Resource Plans', href: '/resource-plans', icon: Calendar },
]

// Admin settings (requires special permissions)
const adminNavigation = [
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'Organization', href: '/organization', icon: Building2 },
    { name: 'Settings', href: '/settings', icon: Settings },
]

const requestBoardLink = { name: '요청 게시판', href: '/requests', icon: MessageSquare }

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, logout } = useAuth()

    const handleLogout = () => {
        logout()
        window.location.href = '/login'
    }

    const renderNavItem = (item: { name: string; href: string; icon: any }) => {
        const isActive = location.pathname === item.href
        return (
            <Link
                key={item.name}
                to={item.href}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                    isCollapsed && 'justify-center px-2'
                )}
            >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
            </Link>
        )
    }

    const renderSection = (
        title: string,
        icon: React.ElementType,
        items: typeof monitoringNavigation,
        showDivider = false
    ) => (
        <div className={showDivider ? 'pt-3' : ''}>
            {showDivider && <div className="border-t border-slate-700 mb-3" />}
            {!isCollapsed && (
                <div className="mb-2 flex items-center gap-2 px-3">
                    {React.createElement(icon, { className: 'h-4 w-4 text-slate-500' })}
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {title}
                    </span>
                </div>
            )}
            {isCollapsed && showDivider && (
                <div className="flex justify-center mb-2">
                    {React.createElement(icon, { className: 'h-4 w-4 text-slate-500' })}
                </div>
            )}
            <div className="space-y-1">
                {items.map(renderNavItem)}
            </div>
        </div>
    )

    return (
        <div
            className={cn(
                "flex h-full flex-col bg-slate-900 transition-all duration-300 ease-in-out",
                isCollapsed ? "w-16" : "w-64"
            )}
        >
            {/* Logo & Toggle */}
            <div className="flex h-16 items-center justify-between px-3">
                <div className={cn("flex items-center gap-2", isCollapsed && "justify-center w-full")}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 flex-shrink-0">
                        <span className="text-sm font-bold text-white">E</span>
                    </div>
                    {!isCollapsed && (
                        <span className="text-lg font-semibold text-white">Edwards POB</span>
                    )}
                </div>
                {!isCollapsed && (
                    <button
                        onClick={onToggle}
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="사이드바 접기"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Greeting - moved from header */}
            <div className={cn(
                "px-3 py-3 border-b border-slate-700",
                isCollapsed && "px-2"
            )}>
                {isCollapsed ? (
                    <div className="flex justify-center">
                        <span className="text-lg">👋</span>
                    </div>
                ) : (
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-3">
                        <p className="text-sm font-medium text-white/90 flex items-center gap-1">
                            <span>👋</span> Welcome,
                        </p>
                        <p className="text-base font-bold text-white truncate">
                            {user?.name || user?.korean_name || 'Guest'}!
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
                        title="사이드바 열기"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
                {/* Monitoring Section */}
                {renderSection('Monitoring', Eye, monitoringNavigation)}

                {/* Entry Section */}
                {renderSection('Entry', PenSquare, entryNavigation, true)}

                {/* Admin Settings Section */}
                {renderSection('Admin Settings', Shield, adminNavigation, true)}
            </nav>

            {/* Request board quick access */}
            {!isCollapsed && (
                <div className="px-2 pb-4">
                    <div className="rounded-lg bg-slate-800/60 p-3 shadow-inner">
                        {renderNavItem(requestBoardLink)}
                        <p className="mt-2 text-xs text-slate-400">피드백/개선/의견을 남겨주세요.</p>
                    </div>
                </div>
            )}
            {isCollapsed && (
                <div className="px-2 pb-4">
                    {renderNavItem(requestBoardLink)}
                </div>
            )}

            {/* User info & Logout */}
            <div className={cn(
                "border-t border-slate-700 p-3 space-y-3",
                isCollapsed && "p-2"
            )}>
                {isCollapsed ? (
                    <>
                        <div className="flex justify-center">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700">
                                <span className="text-sm font-medium text-white">
                                    {user?.korean_name?.[0] || user?.name?.[0] || 'U'}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            title="Logout"
                            className="flex w-full items-center justify-center gap-2 rounded-lg p-2 text-sm font-medium text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => navigate('/profile')}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
                        >
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 flex-shrink-0">
                                <span className="text-sm font-medium text-white">
                                    {user?.korean_name?.[0] || user?.name?.[0] || 'U'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="truncate text-sm font-medium text-white">
                                    {user?.korean_name || user?.name || 'User'}
                                </p>
                                <p className="truncate text-xs text-slate-400">
                                    {user?.email || 'user@edwards.com'}
                                </p>
                            </div>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
