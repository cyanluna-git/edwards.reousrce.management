import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

export function MainLayout() {
    const { user } = useAuth();

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar */}
            <Sidebar />

            {/* Main content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top header */}
                <header className="flex h-16 items-center justify-between border-b bg-gradient-to-r from-blue-600 to-blue-800 px-6">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-white">
                            👋 안녕하세요, {user?.name || user?.korean_name || 'Guest'}님!
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="relative text-white hover:bg-blue-700">
                            <Bell className="h-5 w-5" />
                            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                        </Button>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

