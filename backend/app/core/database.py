"""
Database connection and session management
"""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session

from app.core.config import settings

# Base class for models (created before engine for import order)
Base = declarative_base()

# Engine and session will be created lazily
_engine = None
_SessionLocal = None


def get_engine():
    """Get or create database engine (lazy initialization)"""
    global _engine
    if _engine is None:
        _engine = create_engine(
            settings.DATABASE_URL,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            pool_recycle=300,
        )
    return _engine


def get_session_local():
    """Get or create session factory (lazy initialization)"""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=get_engine()
        )
    return _SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Dependency for database session"""
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# For backwards compatibility
def get_engine_instance():
    return get_engine()
