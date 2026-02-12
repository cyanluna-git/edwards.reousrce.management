# Frontend (React + Vite) - Claude Code Guide

> **Created**: 2026-02-12 (Thu) 00:35 UTC

## Architecture Pattern: Pages → Hooks → API Client

### Key Principle

**Pages use hooks for data. Hooks wrap API calls with TanStack Query.**

```
User
  ↓
Page Component (renders UI)
  ↓
Hook (TanStack Query)
  ↓
API Client (Axios)
  ↓
Backend
```

### 1. Pages (pages/*Page.tsx)

Top-level page components. Lazy-loaded except LandingPage and LoginPage.

```typescript
// src/pages/DashboardPage.tsx
import { useUsers } from '@/hooks/useUsers';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function DashboardPage() {
  const { data: users, isLoading, error } = useUsers();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-6">
      <h1>Dashboard</h1>
      {users?.map(user => (
        <Card key={user.id}>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </Card>
      ))}
    </div>
  );
}
```

### 2. Hooks (hooks/use*.ts)

All data fetching with TanStack Query. Handles caching, refetch, errors.

```typescript
// src/hooks/useUsers.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
}

export function useUser(userId: string) {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => api.getUser(userId),
    enabled: !!userId, // Don't fetch if no userId
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: (data) => api.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

### 3. API Client (api/client.ts)

Axios client with auth interceptor. All API functions here.

```typescript
// src/api/client.ts
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({ baseURL });

// Auth interceptor
client.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
client.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        const { data } = await axios.post('/api/auth/refresh', {
          refreshToken,
        });
        localStorage.setItem('token', data.access_token);
        // Retry original request
        error.config.headers.Authorization = `Bearer ${data.access_token}`;
        return client(error.config);
      }
    }
    return Promise.reject(error);
  }
);

// API functions
export const api = {
  getUsers: () => client.get('/users').then(r => r.data),
  getUser: (id: string) => client.get(`/users/${id}`).then(r => r.data),
  createUser: (data) => client.post('/users', data).then(r => r.data),
  updateUser: (id: string, data) => 
    client.put(`/users/${id}`, data).then(r => r.data),
  deleteUser: (id: string) => client.delete(`/users/${id}`),
};
```

## Project Structure

```
frontend/src/
├── App.tsx               # Router config, protected routes
├── main.tsx              # Entry point
├── api/
│   └── client.ts           # Axios + all API functions
├── components/
│   ├── ui/                 # Shadcn/UI primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Dialog.tsx
│   ├── UserForm.tsx        # Domain components
│   ├── TaskList.tsx
│   └── Layout/
├── hooks/
│   ├── useUsers.ts         # TanStack Query hooks
│   ├── useAuth.tsx
│   └── useProjects.ts
├── pages/
│   ├── LandingPage.tsx     # Not lazy-loaded
│   ├── LoginPage.tsx       # Not lazy-loaded
│   ├── DashboardPage.tsx   # Lazy-loaded
│   ├── UsersPage.tsx
│   └── SettingsPage.tsx
├── types/
│   └── index.ts            # All TypeScript interfaces
├── lib/
│   └── utils.ts            # cn(), formatDate, etc.
├── context/
│   └── AuthContext.tsx
├── App.css
└── index.css
```

## Core Files

### types/index.ts - Centralized TypeScript

```typescript
// src/types/index.ts
export interface UserInterface {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectInterface {
  id: string;
  name: string;
  status: 'Prospective' | 'Planned' | 'InProgress' | 'OnHold' | 'Completed';
  project_manager_id: string;
}

export interface WorklogInterface {
  id: string;
  user_id: string;
  project_id: string;
  hours: number;
  date: string;
  description: string;
}
```

### App.tsx - Routing & Auth

```typescript
// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" />;
  return children;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

## Components

### Shadcn/UI Components (ui/)

Use `cn()` for conditional styling:

```typescript
import { cn } from '@/lib/utils';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  isLoading?: boolean;
}

export function Button({ variant = 'primary', isLoading, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded',
        variant === 'primary' && 'bg-blue-500 text-white',
        variant === 'secondary' && 'bg-gray-200',
        isLoading && 'opacity-50 cursor-not-allowed'
      )}
      disabled={isLoading}
      {...props}
    />
  );
}
```

## Commands

```bash
cd frontend
pnpm install
pnpm dev --port 3004          # Dev server
pnpm build                    # Production build
pnpm preview                  # Preview production
pnpm test:e2e                 # Playwright tests
pnpm test:e2e --headed       # With browser
pnpm lint                     # ESLint
```

## Code Style & Rules

- Refer to: `@../../.claude/rules/code-style.md`
- Testing: `@../../.claude/rules/testing.md`
- Commit: `@../../.claude/rules/commit-workflow.md`
