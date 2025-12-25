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
    job_positions,
    project_roles,
    hiring_plans,
    work_types,
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
        # Azure Static Web Apps - 배포 후 실제 URL로 변경하세요
        "https://*.azurestaticapps.net",
        "https://edwards-web.azurestaticapps.net",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Startup event to create tables and seed initial data
@app.on_event("startup")
async def startup_event():
    import os
    from sqlalchemy import text

    engine = get_engine()
    print("Running database startup event...")

    reset_db = os.getenv("RESET_DB", "false").lower() == "true"

    if reset_db:
        # Drop all existing tables with CASCADE (only when explicitly requested)
        with engine.connect() as conn:
            conn.execute(text("DROP SCHEMA public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))
            conn.commit()
        print("All tables dropped (RESET_DB=true).")

    # Create all new tables based on models (creates only if not exist)
    Base.metadata.create_all(bind=engine)
    print("All tables created/verified.")

    # Seed data only if admin user doesn't exist (empty DB check)
    with closing(next(get_db())) as db:
        from app.models import User

        admin_exists = db.query(User).filter(User.email == "admin@edwards.com").first()
        if not admin_exists or reset_db:
            init_data(db)
            print("Initial data seeded.")
        else:
            print("Database already has data. Skipping seeding.")
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
app.include_router(
    job_positions.router,
    prefix="/api/job-positions",
    tags=["Job Positions (Functional Roles)"],
)
app.include_router(
    project_roles.router, prefix="/api/project-roles", tags=["Project Roles"]
)
app.include_router(
    hiring_plans.router, prefix="/api/hiring-plans", tags=["Hiring Plans"]
)
app.include_router(work_types.router, prefix="/api/work-types", tags=["Work Types"])


@app.get("/", tags=["Health"])
async def root():
    return {"message": "Edwards Project Operation Board API", "status": "running"}


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
