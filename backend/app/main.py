"""
Edwards Project Operation Board - FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.endpoints import auth, users, departments, projects, worklogs, resource_plans, reports

app = FastAPI(
    title=settings.APP_NAME,
    description="Integrated resource management platform for Edwards PCP management",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(departments.router, prefix="/api/departments", tags=["Departments"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(worklogs.router, prefix="/api/worklogs", tags=["WorkLogs"])
app.include_router(resource_plans.router, prefix="/api/resource-plans", tags=["Resource Plans"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])


@app.get("/", tags=["Health"])
async def root():
    return {"message": "Edwards Project Operation Board API", "status": "running"}


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
