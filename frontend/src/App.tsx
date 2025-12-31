import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { MainLayout } from './components/layout';
import { DashboardPage, LoginPage, ProjectsPage, ProjectDetailPage, WorkLogsPage, WorkLogTablePage, ResourcePlansPage, OrganizationPage, ReportsPage, ProjectAdminPage } from './pages';

import './App.css';

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
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/worklogs" element={<WorkLogsPage />} />
            <Route path="/worklogs-table" element={<WorkLogTablePage />} />
            <Route path="/resource-plans" element={<ResourcePlansPage />} />
            <Route path="/organization" element={<OrganizationPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/admin/projects" element={<ProjectAdminPage />} />
            {/* Add other protected routes here */}
            <Route path="*" element={<Navigate to="/" />} />

          </Route>
        ) : (
          <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
