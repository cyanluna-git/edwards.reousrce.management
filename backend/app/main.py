"""
Edwards Project Operation Board - FastAPI Backend
"""

from contextlib import closing
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base, get_engine, get_db  # Import get_db
from app.api.endpoints import (
    auth,
    users,
    departments,
    projects,
    worklogs,
    resource_plans,
    reports,
    scenarios,
    dashboard,
)

# Import all models to ensure they are registered with SQLAlchemy Base.metadata
import app.models

from scripts.initial_data import init_data  # Import the initialization function

app = FastAPI(
    title=settings.APP_NAME,
    description="Integrated resource management platform for Edwards PCP management",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
    ],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Startup event to create tables and seed initial data
@app.on_event("startup")
async def startup_event():
    engine = get_engine()
    print("Running database startup event...")

    # Drop all existing tables
    Base.metadata.drop_all(bind=engine)
    print("All tables dropped.")

    # Create all new tables based on models
    Base.metadata.create_all(bind=engine)
    print("All tables created.")

    # Use closing to ensure the session is closed
    with closing(next(get_db())) as db:
        init_data(db)
    print("Database startup event complete.")


# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(departments.router, prefix="/api/departments", tags=["Departments"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(worklogs.router, prefix="/api/worklogs", tags=["WorkLogs"])
app.include_router(
    resource_plans.router, prefix="/api/resource-plans", tags=["Resource Plans"]
)
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(scenarios.router, prefix="/api", tags=["Scenarios"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])


@app.get("/", tags=["Health"])
async def root():
    return {"message": "Edwards Project Operation Board API", "status": "running"}


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
