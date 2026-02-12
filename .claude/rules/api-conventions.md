# API Conventions

> **Created**: 2026-02-12 (Thu) 00:35 UTC

## FastAPI Endpoint Design

### Router Organization

```python
# app/api/endpoints/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.schemas import UserCreate, UserResponse
from app.services import UserService

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=list[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    _: str = Depends(require_role(["ADMIN", "PM"]))
):
    """List all users with pagination."""
    service = UserService(db)
    return service.list(skip=skip, limit=limit)

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_role(["ADMIN"]))
):
    """Create a new user."""
    service = UserService(db)
    return service.create(**data.dict())

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Fetch a specific user."""
    service = UserService(db)
    user = service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

### Registration

Register routers in `app/main.py`:
```python
from app.api.endpoints import users, projects, worklogs

app.include_router(users.router)
app.include_router(projects.router)
app.include_router(worklogs.router)
```

## Response Models

### Schema Structure

```python
# app/schemas/users.py
from pydantic import BaseModel, Field
from datetime import datetime

class UserBase(BaseModel):
    """Base user schema."""
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")

class UserCreate(UserBase):
    """Schema for creating a user."""
    password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    """Schema for updating a user (all fields optional)."""
    name: str | None = None
    email: str | None = None

class UserResponse(UserBase):
    """Schema for API responses."""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # ORM mode
```

## Error Handling

### Standard Error Response

```python
# app/core/exceptions.py
from fastapi import HTTPException, status

class ResourceNotFound(HTTPException):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} with id {resource_id} not found"
        )

class UnauthorizedError(HTTPException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=message
        )

class PermissionDeniedError(HTTPException):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message
        )
```

### Usage

```python
user = service.get_by_id(user_id)
if not user:
    raise ResourceNotFound("User", user_id)
```

## REST Conventions

### HTTP Methods & Status Codes

| Method | Path | Status | Purpose |
|--------|------|--------|----------|
| GET | `/resource` | 200 | List all |
| POST | `/resource` | 201 | Create new |
| GET | `/resource/{id}` | 200 | Get one |
| PUT/PATCH | `/resource/{id}` | 200 | Update |
| DELETE | `/resource/{id}` | 204 | Delete |

### Naming Convention

- **Resources:** Plural nouns (`/users`, `/projects`, `/worklogs`)
- **Sub-resources:** `/users/{user_id}/projects`
- **Actions:** Use verbs in query params or separate endpoints for complex operations
  - `POST /projects/search` (complex search)
  - `GET /projects?status=InProgress` (simple filters)

## Pagination

```python
class PaginationParams(BaseModel):
    skip: int = 0
    limit: int = 10

@router.get("/", response_model=list[UserResponse])
async def list_users(
    params: PaginationParams = Depends(),
    db: Session = Depends(get_db)
):
    return service.list(skip=params.skip, limit=params.limit)
```

## Query Parameters

```python
@router.get("/search")
async def search(
    q: str,  # Search query
    status: str | None = None,  # Filter
    sort_by: str = "created_at",  # Sort
    order: str = "desc",  # asc/desc
    db: Session = Depends(get_db)
):
    """Search with filters and sorting."""
    return service.search(q, status=status, sort_by=sort_by, order=order)
```
