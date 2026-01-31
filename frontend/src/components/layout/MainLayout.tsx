import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

// localStorage key for sidebar state
const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function MainLayout() {
    // Initialize from localStorage, default to false (expanded)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        return saved === 'true';
    });

    // Save to localStorage when changed
    useEffect(() => {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
    }, [isSidebarCollapsed]);

    const toggleSidebar = () => {
        setIsSidebarCollapsed(prev => !prev);
    };

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar */}
            <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />

            {/* Main content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Minimal top bar - just notification */}
                <header className="flex h-12 items-center justify-end border-b bg-white px-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="relative text-slate-600 hover:bg-slate-100">
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
