"""
Application configuration and settings
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Edwards Project Operation Board"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = (
        "mssql+pyodbc://sa:YourStrong@Password123@localhost:1433/edwards?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes"
    )

    # JWT
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
