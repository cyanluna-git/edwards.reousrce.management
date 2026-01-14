import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
    LayoutDashboard,
    FolderKanban,
    Users,
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
} from 'lucide-react'

// Monitoring - View/Analysis
const monitoringNavigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Team', href: '/team', icon: Users },
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

export function Sidebar() {
    const location = useLocation()
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
                className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
            >
                <item.icon className="h-5 w-5" />
                {item.name}
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
            <div className="mb-2 flex items-center gap-2 px-3">
                {React.createElement(icon, { className: 'h-4 w-4 text-slate-500' })}
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {title}
                </span>
            </div>
            <div className="space-y-1">
                {items.map(renderNavItem)}
            </div>
        </div>
    )

    return (
        <div className="flex h-full w-64 flex-col bg-slate-900">
            {/* Logo */}
            <div className="flex h-16 items-center gap-2 px-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                    <span className="text-sm font-bold text-white">E</span>
                </div>
                <span className="text-lg font-semibold text-white">Edwards POB</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {/* Monitoring Section */}
                {renderSection('Monitoring', Eye, monitoringNavigation)}

                {/* Entry Section */}
                {renderSection('Entry', PenSquare, entryNavigation, true)}

                {/* Admin Settings Section */}
                {renderSection('Admin Settings', Shield, adminNavigation, true)}
            </nav>

            {/* Request board quick access */}
            <div className="px-3 pb-4">
                <div className="rounded-lg bg-slate-800/60 p-3 shadow-inner">
                    {renderNavItem(requestBoardLink)}
                    <p className="mt-2 text-xs text-slate-400">피드백/개선/의견을 남겨주세요.</p>
                </div>
            </div>

            {/* User info & Logout */}
            <div className="border-t border-slate-700 p-4 space-y-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700">
                        <span className="text-sm font-medium text-white">
                            {user?.korean_name?.[0] || user?.name?.[0] || 'U'}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                            {user?.korean_name || user?.name || 'User'}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                            {user?.email || 'user@edwards.com'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </button>
            </div>
        </div>
    )
}
