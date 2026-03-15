import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ReleaseNotesModal } from './ReleaseNotesModal'

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
            <Sidebar
                isCollapsed={isSidebarCollapsed}
                onToggle={toggleSidebar}
            />
            <ReleaseNotesModal />

            {/* Main content - full height, no header */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    )
}
