# Testing Guide

> **Created**: 2026-02-12 (Thu) 00:35 UTC

## Backend (pytest)

### Test File Organization

```
backend/tests/
├── test_users.py          # Test module: test_{entity_name}.py
├── test_projects.py
├── test_worklogs.py
├── conftest.py            # Shared fixtures
└── integration/
    └── test_auth_flow.py
```

### Writing Tests

**File naming:** `test_{module_name}.py`  
**Function naming:** `test_{what_it_tests}`  
**Class naming:** `Test{Entity}` (optional)

```python
import pytest
from sqlalchemy.orm import Session
from app.models import User
from app.services import UserService

@pytest.fixture
def db_session():
    """Create a test database session."""
    # Setup
    yield session
    # Teardown

def test_create_user(db_session: Session):
    """Test creating a new user."""
    service = UserService(db_session)
    user = service.create(name="John", email="john@example.com")
    
    assert user.id is not None
    assert user.name == "John"

@pytest.mark.asyncio
async def test_async_fetch():
    """Test async operations."""
    data = await fetch_data("https://api.example.com")
    assert data is not None
```

### Running Tests

```bash
# All tests
pytest

# Single file
pytest tests/test_users.py

# Single test
pytest tests/test_users.py::test_create_user

# By keyword
pytest -k "test_create"

# Verbose output
pytest -v

# Show print statements
pytest -s

# Coverage
pytest --cov=app tests/
```

### Test Coverage

Target: **80%+ overall, 95%+ for services**

```bash
pytest --cov=app --cov-report=html tests/
```

## Frontend (Playwright E2E)

### Test File Organization

```
frontend/tests/
├── auth.spec.ts           # {feature}.spec.ts
├── dashboard.spec.ts
├── worklogs.spec.ts
└── fixtures/
    └── auth-user.ts
```

### Writing E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@edwards.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button:has-text("Sign In")');
    
    // Assert redirected to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrong');
    await page.click('button:has-text("Sign In")');
    
    await expect(page.locator('.error')).toBeVisible();
  });
});
```

### Running E2E Tests

```bash
# Run all tests
pnpm test:e2e

# Headed mode (see browser)
pnpm test:e2e --headed

# Single test file
pnpm test:e2e auth.spec.ts

# Debug mode
pnpm test:e2e --debug
```

## Unit Testing (React Components)

Use Vitest + React Testing Library (if implemented):

```typescript
import { render, screen } from '@testing-library/react';
import { UserForm } from '@/components/UserForm';

describe('UserForm', () => {
  it('should render form fields', () => {
    render(<UserForm />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });
});
```

## Best Practices

1. **One assertion per test** (or closely related)
2. **Use descriptive test names** — test name should explain what passes/fails
3. **Mock external APIs** — don't hit real endpoints in tests
4. **Test behavior, not implementation** — focus on input/output
5. **Keep tests isolated** — each test should be independent
6. **Use fixtures for setup** — DRY out common setup code
