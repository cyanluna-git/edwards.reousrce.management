import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from '@/components/layout'
import { DashboardPage } from '@/pages'

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// Placeholder pages - to be implemented
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="space-y-4">
    <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
    <p className="text-slate-500">This page is under construction.</p>
  </div>
)

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="projects" element={<PlaceholderPage title="Projects" />} />
            <Route path="worklogs" element={<PlaceholderPage title="WorkLogs" />} />
            <Route path="resource-plans" element={<PlaceholderPage title="Resource Plans" />} />
            <Route path="team" element={<PlaceholderPage title="Team" />} />
            <Route path="reports" element={<PlaceholderPage title="Reports" />} />
            <Route path="organization" element={<PlaceholderPage title="Organization" />} />
            <Route path="settings" element={<PlaceholderPage title="Settings" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
