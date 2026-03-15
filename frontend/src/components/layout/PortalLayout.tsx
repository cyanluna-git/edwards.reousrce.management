import { Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function PortalLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff5f5_0%,#fff8f6_28%,#f8fafc_100%)]">
      <header className="sticky top-0 z-20 border-b border-red-100/80 bg-white/90 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            {user?.name && (
              <span className="text-sm text-slate-600">{user.name}</span>
            )}
            <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
