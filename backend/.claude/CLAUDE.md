# Backend (FastAPI) - Claude Code Guide

> **Created**: 2026-02-12 (Thu) 00:35 UTC

## Architecture Pattern: Endpoints → Services → Models

### Key Principle

**Endpoints are thin HTTP layers. All business logic goes in Services.**

```python
HTTP Request
  ↓
Endpoint (validate, route, authorize)
  ↓
Service (business logic)
  ↓
Model (database)
  ↓
Database
```

### 1. Endpoints (api/endpoints/*.py)

Only handle routing, authorization, response formatting. **No business logic.**

```python
# app/api/endpoints/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_role
from app.schemas import UserCreate, UserResponse
from app.services import UserService

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_role(["ADMIN"]))
):
    service = UserService(db)
    return service.create(data)

@router.get("/")
async def list_users(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    service = UserService(db)
    return service.list(skip=skip, limit=limit)
```

### 2. Services (services/*_service.py)

All business logic, validation, database transactions.

```python
# app/services/user_service.py
from sqlalchemy.orm import Session
from app.models import User
from app.schemas import UserCreate
from app.core.security import hash_password

class UserService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: UserCreate) -> User:
        user = User(
            name=data.name,
            email=data.email,
            hashed_password=hash_password(data.password)
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def list(self, skip: int = 0, limit: int = 10) -> list[User]:
        return self.db.query(User).offset(skip).limit(limit).all()

    def get_by_id(self, user_id: str) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def update(self, user_id: str, data) -> User | None:
        user = self.get_by_id(user_id)
        if not user:
            return None
        for field, value in data.dict(exclude_unset=True).items():
            setattr(user, field, value)
        self.db.commit()
        self.db.refresh(user)
        return user
```

### 3. Models (models/*.py)

SQLAlchemy ORM definitions only.

```python
# app/models/user.py
from sqlalchemy import Column, String, DateTime, Boolean
from app.core.database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True)
    hashed_password = Column(String(255))
    role = Column(String(20), default="USER")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
```

### 4. Schemas (schemas/*.py)

Pydantic models for validation and serialization.

```python
# app/schemas/users.py
from pydantic import BaseModel, EmailStr
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True
```

## Project Structure

```
backend/
├── app/
│   ├── main.py
│   ├── api/endpoints/
│   │   ├── users.py
│   │   ├── projects.py
│   │   └── worklogs.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── security.py
│   │   └── exceptions.py
│   ├── models/
│   ├── schemas/
│   ├── services/
│   └── scripts/
├── tests/
├── alembic/
└── requirements.txt
```

## Database Migrations (Alembic)

```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
```

## Commands

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8004

# Tests
pytest
pytest tests/test_users.py -v
pytest -k "test_create"

# Linting
flake8 app/
black app/
mypy app/
```

## Code Style & Rules

- Refer to: `@../../.claude/rules/code-style.md`
- Testing: `@../../.claude/rules/testing.md`
- API Conventions: `@../../.claude/rules/api-conventions.md`
- Security: `@../../.claude/rules/security.md`
