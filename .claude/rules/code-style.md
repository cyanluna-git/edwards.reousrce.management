# Code Style Guide

> **Created**: 2026-02-12 (Thu) 00:35 UTC

## Python (Backend)

### Naming Conventions

- **Functions & variables:** `snake_case`
- **Classes:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Modules:** `snake_case.py`

### Type Hints

**Required everywhere:**
```python
def get_user(user_id: str, db: Session) -> User | None:
    """Fetch user by ID."""
    pass

class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
```

### Async Functions

Use `async def` for I/O operations (database, API calls):
```python
async def fetch_data(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
    return response.json()
```

### Imports

```python
# Standard library
import json
from typing import TYPE_CHECKING

# Third-party
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

# Local
from app.core.config import settings
from app.models import User
from app.schemas import UserResponse
from app.services import UserService

if TYPE_CHECKING:
    from app.core.database import SessionLocal
```

## TypeScript / React (Frontend)

### File Structure

```
src/
├── components/
│   ├── UserForm.tsx          # PascalCase
│   ├── TaskList.tsx
│   └── ui/                   # Shadcn/UI primitives
│       ├── Button.tsx
│       └── Card.tsx
├── pages/
│   ├── DashboardPage.tsx     # PascalCase + Page suffix
│   ├── SettingsPage.tsx
├── hooks/
│   ├── useUsers.ts           # use* prefix
│   ├── useAuth.tsx
├── types/
│   └── index.ts              # Centralized TypeScript
├── api/
│   └── client.ts             # Axios + all API functions
├── lib/
│   └── utils.ts              # Utilities (cn(), formatDate)
```

### Naming

- **Components:** `PascalCase.tsx`
- **Hooks:** `use*.ts` (camelCase prefix)
- **Pages:** `*Page.tsx` (PascalCase)
- **Types:** Defined in `types/index.ts`
- **Functions:** `camelCase`

### Component Structure

```typescript
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { UserInterface } from '@/types';

interface UserFormProps {
  onSubmit?: (user: UserInterface) => void;
  isLoading?: boolean;
}

export function UserForm({ onSubmit, isLoading = false }: UserFormProps) {
  const [name, setName] = useState('');

  return (
    <form className={cn('flex', isLoading && 'opacity-50')}>
      {/* JSX */}
    </form>
  );
}
```

### Path Alias

`@/` → `src/` (configured in `vite.config.ts`):
```typescript
import { UserInterface } from '@/types';
import { useUsers } from '@/hooks/useUsers';
import { Card } from '@/components/ui/Card';
```

## General

- **Language:** All code comments and documentation in English
- **Documentation:** Respond to users in Korean
- **Line Length:** Aim for <100 characters (soft limit)
- **Indentation:** 4 spaces (Python), 2 spaces (TypeScript)
