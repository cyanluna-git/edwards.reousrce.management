import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    FolderKanban,
    Users,
    Clock,
    Calendar,
    BarChart3,
    Settings,
    Building2,
} from 'lucide-react'

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'WorkLogs', href: '/worklogs', icon: Clock },
    { name: 'Resource Plans', href: '/resource-plans', icon: Calendar },
    { name: 'Team', href: '/team', icon: Users },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Organization', href: '/organization', icon: Building2 },
    { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
    const location = useLocation()

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
            </nav>

            {/* User info */}
            <div className="border-t border-slate-700 p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700">
                        <span className="text-sm font-medium text-white">U</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-white">User Name</p>
                        <p className="truncate text-xs text-slate-400">user@edwards.com</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
