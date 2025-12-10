"""Seed admin user for testing

Revision ID: 003_seed_admin_user
Revises: 002_seed_data
Create Date: 2024-12-11

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from datetime import datetime
from passlib.context import CryptContext

revision: str = "003_seed_admin_user"
down_revision: Union[str, None] = "002_seed_data"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade() -> None:
    # Hash the password using bcrypt
    hashed_password = pwd_context.hash("admin123")

    # Insert admin user
    # Note: department_id=1 (Control Engineering), position_id='POS_PM' (Project Manager)
    op.execute(
        f"""
        INSERT INTO users (id, email, hashed_password, name, korean_name, department_id, position_id, role, is_active, hire_date, created_at, updated_at)
        VALUES (
            'admin-user-0001-0000-000000000001',
            'admin@edwards.com',
            '{hashed_password}',
            'Admin User',
            N'관리자',
            1,
            'POS_PM',
            'ADMIN',
            1,
            GETDATE(),
            GETDATE(),
            GETDATE()
        )
    """
    )

    # Insert test users for each role
    test_users = [
        (
            "user-test-0002-0000-000000000002",
            "pm@edwards.com",
            "pm123",
            "Project Manager",
            "프로젝트매니저",
            1,
            "POS_PM",
            "PM",
        ),
        (
            "user-test-0003-0000-000000000003",
            "fm@edwards.com",
            "fm123",
            "Function Manager",
            "기능매니저",
            1,
            "POS_MANAGER",
            "FM",
        ),
        (
            "user-test-0004-0000-000000000004",
            "user@edwards.com",
            "user123",
            "Test User",
            "테스트유저",
            1,
            "POS_SW_ENG",
            "USER",
        ),
    ]

    for (
        user_id,
        email,
        password,
        name,
        korean_name,
        dept_id,
        pos_id,
        role,
    ) in test_users:
        hashed = pwd_context.hash(password)
        op.execute(
            f"""
            INSERT INTO users (id, email, hashed_password, name, korean_name, department_id, position_id, role, is_active, hire_date, created_at, updated_at)
            VALUES (
                '{user_id}',
                '{email}',
                '{hashed}',
                '{name}',
                N'{korean_name}',
                {dept_id},
                '{pos_id}',
                '{role}',
                1,
                GETDATE(),
                GETDATE(),
                GETDATE()
            )
        """
        )


def downgrade() -> None:
    op.execute(
        "DELETE FROM users WHERE email IN ('admin@edwards.com', 'pm@edwards.com', 'fm@edwards.com', 'user@edwards.com')"
    )
