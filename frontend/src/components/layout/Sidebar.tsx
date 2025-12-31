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
    Table,
    LogOut,
} from 'lucide-react'

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'WorkLogs', href: '/worklogs', icon: Clock },
    { name: 'WorkLog Table', href: '/worklogs-table', icon: Table },
    { name: 'Resource Plans', href: '/resource-plans', icon: Calendar },
    { name: 'Team', href: '/team', icon: Users },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Organization', href: '/organization', icon: Building2 },
    { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
    const location = useLocation()
    const { user, logout } = useAuth()

    const handleLogout = () => {
        logout()
        window.location.href = '/login'
    }

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
                {navigation.map((item) => {
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
                })}

                {/* Admin Links */}
                {['ADMIN', 'PM', 'FM'].includes(user?.role || '') && (
                    <>
                        <div className="my-2 border-t border-slate-700 mx-2" />
                        <Link
                            to="/admin/projects"
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                location.pathname === '/admin/projects'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            )}
                        >
                            <Settings className="h-5 w-5" />
                            Project Admin
                        </Link>
                    </>
                )}
            </nav>


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
