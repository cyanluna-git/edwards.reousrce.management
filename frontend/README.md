# Edwards Project Operation Board - Frontend

React + TypeScript + Vite + Tailwind CSS

## Setup

### Install dependencies
```bash
pnpm install
```

### Start development server
```bash
pnpm dev
```
→ Open http://localhost:3000

### Build for production
```bash
pnpm build
```

### Preview production build
```bash
pnpm preview
```

## Project Structure
```
frontend/
├── src/
│   ├── api/           # API client and service functions
│   ├── components/
│   │   ├── layout/    # Layout components (Sidebar, MainLayout)
│   │   └── ui/        # Reusable UI components (Button, Card, Input)
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utility functions
│   ├── pages/         # Page components
│   ├── types/         # TypeScript type definitions
│   ├── App.tsx        # Main app with routing
│   ├── main.tsx       # Entry point
│   └── index.css      # Global styles + Tailwind
├── vite.config.ts     # Vite configuration
├── tsconfig.json      # TypeScript configuration
└── package.json       # Dependencies
```

## Tech Stack
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS 4** - Styling
- **React Router 7** - Routing
- **TanStack Query** - Data fetching
- **Axios** - HTTP client
- **Lucide React** - Icons

## API Proxy
Development server proxies `/api` requests to `http://localhost:8000` (FastAPI backend).

## Path Aliases
- `@/*` → `./src/*`

Example:
```tsx
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
```
