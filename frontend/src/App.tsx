import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { MainLayout, PortalLayout } from './components/layout';
import { LandingPage, LoginPage, RegisterPage } from './pages';

import './App.css';

// Route-level code splitting - lazy load pages for smaller initial bundle
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const WorkLogsPage = lazy(() => import('./pages/WorkLogsPage').then(m => ({ default: m.WorkLogsPage })));
const WorkLogTablePage = lazy(() => import('./pages/WorkLogTablePage').then(m => ({ default: m.WorkLogTablePage })));
const ResourcePlansPage = lazy(() => import('./pages/ResourcePlansPage').then(m => ({ default: m.ResourcePlansPage })));
const ResourceMatrixPage = lazy(() => import('./pages/ResourceMatrixPage').then(m => ({ default: m.ResourceMatrixPage })));
const OrganizationPage = lazy(() => import('./pages/OrganizationPage').then(m => ({ default: m.OrganizationPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const RequestBoardPage = lazy(() => import('./pages/RequestBoardPage').then(m => ({ default: m.RequestBoardPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const UpdatesPage = lazy(() => import('./pages/UpdatesPage').then(m => ({ default: m.UpdatesPage })));
const PortalPage = lazy(() => import('./pages/PortalPage'));
const PortalStatsPage = lazy(() => import('./pages/PortalStatsPage'));

// Loading fallback for lazy-loaded routes
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {isAuthenticated ? (
          <>
            {/* Portal — clean layout, no sidebar */}
            <Route element={<PortalLayout />}>
              <Route path="/" element={<Navigate to="/portal" replace />} />
              <Route path="/portal" element={<Suspense fallback={<PageLoader />}><PortalPage /></Suspense>} />
              <Route path="/portal/stats" element={<Suspense fallback={<PageLoader />}><PortalStatsPage /></Suspense>} />
            </Route>

            {/* EOB app — full layout with sidebar */}
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
              <Route path="/projects" element={<Suspense fallback={<PageLoader />}><ProjectsPage /></Suspense>} />
              <Route path="/projects/:id" element={<Suspense fallback={<PageLoader />}><ProjectDetailPage /></Suspense>} />
              <Route path="/worklogs" element={<Suspense fallback={<PageLoader />}><WorkLogsPage /></Suspense>} />
              <Route path="/worklogs-table" element={<Suspense fallback={<PageLoader />}><WorkLogTablePage /></Suspense>} />
              <Route path="/resource-plans" element={<Suspense fallback={<PageLoader />}><ResourcePlansPage /></Suspense>} />
              <Route path="/resource-matrix" element={<Suspense fallback={<PageLoader />}><ResourceMatrixPage /></Suspense>} />
              <Route path="/organization" element={<Suspense fallback={<PageLoader />}><OrganizationPage /></Suspense>} />
              <Route path="/reports" element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
              <Route path="/requests" element={<Suspense fallback={<PageLoader />}><RequestBoardPage /></Suspense>} />
              <Route path="/profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
              <Route path="/updates" element={<Suspense fallback={<PageLoader />}><UpdatesPage /></Suspense>} />
              <Route path="*" element={<Navigate to="/portal" />} />
            </Route>
          </>
        ) : (
          <>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
