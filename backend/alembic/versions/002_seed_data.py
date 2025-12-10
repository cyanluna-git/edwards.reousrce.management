"""Seed initial data - CommonCodes, BusinessUnits, ProjectTypes, Holidays

Revision ID: 002_seed_data
Revises: 001_initial_schema
Create Date: 2024-12-10

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from datetime import datetime


revision: str = "002_seed_data"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === Business Units ===
    op.execute(
        """
        INSERT INTO business_units (id, name, code, is_active) VALUES
        ('BU_IS', 'Integrated System', 'IS', 1),
        ('BU_ABT', 'Abatement', 'ABT', 1),
        ('BU_ACM', 'ACM', 'ACM', 1),
        ('BU_SHARED', 'Shared Services', 'SHARED', 1)
    """
    )

    # === Departments ===
    op.execute(
        """
        INSERT INTO departments (business_unit_id, name, code, is_active) VALUES
        ('BU_IS', 'Control Engineering', 'CTRL_ENG', 1),
        ('BU_IS', 'Central Engineering', 'CENTRAL_ENG', 1),
        ('BU_IS', 'NPI IS', 'NPI_IS', 1),
        ('BU_ABT', 'NPI Abatement', 'NPI_ABT', 1),
        ('BU_ABT', 'ETO', 'ETO', 1),
        ('BU_ACM', 'ACM Tech', 'ACM_TECH', 1)
    """
    )

    # === SubTeams ===
    op.execute(
        """
        INSERT INTO sub_teams (department_id, name, code, is_active) VALUES
        (1, 'Software', 'SW', 1),
        (1, 'Electrical', 'ELEC', 1),
        (2, 'Mechanical', 'MECH', 1),
        (2, 'Analysis Tech', 'ANALYSIS', 1),
        (2, 'DES', 'DES', 1)
    """
    )

    # === JobPositions ===
    op.execute(
        """
        INSERT INTO job_positions (id, name, department_id, sub_team_id, std_hourly_rate, is_active) VALUES
        ('POS_SW_ENG', 'Software Engineer', 1, 1, 50.0, 1),
        ('POS_SW_SENIOR', 'Senior Software Engineer', 1, 1, 70.0, 1),
        ('POS_ELEC_ENG', 'Electrical Engineer', 1, 2, 50.0, 1),
        ('POS_MECH_ENG', 'Mechanical Engineer', 2, 3, 50.0, 1),
        ('POS_PM', 'Project Manager', 2, NULL, 80.0, 1),
        ('POS_MANAGER', 'Engineering Manager', 2, NULL, 100.0, 1)
    """
    )

    # === Project Types ===
    op.execute(
        """
        INSERT INTO project_types (id, name, description, is_active) VALUES
        ('NPI', 'New Product Introduction', 'New product development projects', 1),
        ('ETO', 'Engineer To Order', 'Custom engineering projects', 1),
        ('CIP', 'Continuous Improvement', 'Process improvement projects', 1),
        ('SUPPORT', 'Support', 'Customer support and maintenance', 1),
        ('INTERNAL', 'Internal', 'Internal team tasks and activities', 1)
    """
    )

    # === CommonCodes: WORK_TYPE ===
    op.execute(
        """
        INSERT INTO common_codes (group_code, code_id, name, description, sort_order, is_active) VALUES
        ('WORK_TYPE', 'DESIGN', 'Design', 'Engineering design work', 1, 1),
        ('WORK_TYPE', 'SW_DEVELOP', 'SW Develop', 'Software development', 2, 1),
        ('WORK_TYPE', 'VERIFICATION', 'Verification & Validation', 'Testing and validation', 3, 1),
        ('WORK_TYPE', 'DOCUMENTATION', 'Documentation', 'Technical documentation', 4, 1),
        ('WORK_TYPE', 'REVIEW', 'Review', 'Document and design review', 5, 1),
        ('WORK_TYPE', 'MEETING', 'Meeting', 'Meetings and discussions', 6, 1),
        ('WORK_TYPE', 'LEAVE', 'Leave', 'Vacation and leave', 7, 1),
        ('WORK_TYPE', 'MANAGEMENT', 'Management', 'Project management activities', 8, 1),
        ('WORK_TYPE', 'FIELD_WORK', 'Field/Shopfloor Work', 'On-site field work', 9, 1),
        ('WORK_TYPE', 'WORKSHOP', 'Workshop', 'Training and workshop', 10, 1),
        ('WORK_TYPE', 'RESEARCH', 'Research', 'Research activities', 11, 1),
        ('WORK_TYPE', 'SELF_STUDY', 'Self-Study', 'Self-learning and development', 12, 1),
        ('WORK_TYPE', 'EMAIL', 'Email', 'Email correspondence', 13, 1),
        ('WORK_TYPE', 'CUSTOMER_SUPPORT', 'Customer Support', 'Customer support activities', 14, 1),
        ('WORK_TYPE', 'TRAINING', 'Training', 'Training sessions', 15, 1),
        ('WORK_TYPE', 'ADMIN_WORK', 'Administrative work', 'Administrative tasks', 16, 1),
        ('WORK_TYPE', 'COMPLIANCES', 'Compliances', 'Compliance activities', 17, 1),
        ('WORK_TYPE', 'QA_QC', 'QA/QC', 'Quality assurance and control', 18, 1),
        ('WORK_TYPE', 'SAFETY', 'Safety', 'Safety related activities', 19, 1)
    """
    )

    # === CommonCodes: MEETING_TYPE ===
    op.execute(
        """
        INSERT INTO common_codes (group_code, code_id, name, description, sort_order, is_active) VALUES
        ('MEETING_TYPE', 'DECISION_MAKING', 'Decision Making', 'Decision making meetings', 1, 1),
        ('MEETING_TYPE', 'INFO_SHARING', 'Information Sharing', 'Information sharing sessions', 2, 1),
        ('MEETING_TYPE', 'FEEDBACK', 'Feedback', 'Feedback and 1:1 meetings', 3, 1),
        ('MEETING_TYPE', 'PERIODIC_UPDATE', 'Periodic Updates', 'Weekly/Monthly updates', 4, 1),
        ('MEETING_TYPE', 'PROBLEM_SOLVING', 'Problem Solving', 'Issue resolution meetings', 5, 1),
        ('MEETING_TYPE', 'WORKSHOP', 'Workshop', 'Brainstorming workshops', 6, 1)
    """
    )

    # === CommonCodes: PROJECT_STATUS ===
    op.execute(
        """
        INSERT INTO common_codes (group_code, code_id, name, description, sort_order, is_active) VALUES
        ('PROJECT_STATUS', 'WIP', 'Work In Progress', 'Active project', 1, 1),
        ('PROJECT_STATUS', 'HOLD', 'Hold', 'Project on hold', 2, 1),
        ('PROJECT_STATUS', 'COMPLETED', 'Completed', 'Completed project', 3, 1),
        ('PROJECT_STATUS', 'CANCELLED', 'Cancelled', 'Cancelled project', 4, 1),
        ('PROJECT_STATUS', 'FORECAST', 'Forecast', 'Future planned project', 5, 1)
    """
    )

    # === CommonCodes: CHANGE_TYPE ===
    op.execute(
        """
        INSERT INTO common_codes (group_code, code_id, name, description, sort_order, is_active) VALUES
        ('CHANGE_TYPE', 'HIRE', 'Hire', 'New employee hire', 1, 1),
        ('CHANGE_TYPE', 'TRANSFER_IN', 'Transfer In', 'Transfer into team', 2, 1),
        ('CHANGE_TYPE', 'TRANSFER_OUT', 'Transfer Out', 'Transfer out of team', 3, 1),
        ('CHANGE_TYPE', 'PROMOTION', 'Promotion', 'Position promotion', 4, 1),
        ('CHANGE_TYPE', 'RESIGN', 'Resign', 'Employee resignation', 5, 1)
    """
    )

    # === Korean Holidays 2024-2025 ===
    op.execute(
        """
        INSERT INTO holidays (date, name, type, year) VALUES
        -- 2024
        ('2024-01-01', N'신정', 'LEGAL', 2024),
        ('2024-02-09', N'설날연휴', 'LEGAL', 2024),
        ('2024-02-10', N'설날', 'LEGAL', 2024),
        ('2024-02-11', N'설날연휴', 'LEGAL', 2024),
        ('2024-02-12', N'대체공휴일', 'LEGAL', 2024),
        ('2024-03-01', N'삼일절', 'LEGAL', 2024),
        ('2024-04-10', N'제22대 국회의원 선거일', 'LEGAL', 2024),
        ('2024-05-05', N'어린이날', 'LEGAL', 2024),
        ('2024-05-06', N'대체공휴일', 'LEGAL', 2024),
        ('2024-05-15', N'부처님오신날', 'LEGAL', 2024),
        ('2024-06-06', N'현충일', 'LEGAL', 2024),
        ('2024-08-12', N'창립기념일', 'COMPANY', 2024),
        ('2024-08-15', N'광복절', 'LEGAL', 2024),
        ('2024-09-16', N'추석연휴', 'LEGAL', 2024),
        ('2024-09-17', N'추석', 'LEGAL', 2024),
        ('2024-09-18', N'추석연휴', 'LEGAL', 2024),
        ('2024-10-03', N'개천절', 'LEGAL', 2024),
        ('2024-10-09', N'한글날', 'LEGAL', 2024),
        ('2024-12-25', N'성탄절', 'LEGAL', 2024),
        -- 2025
        ('2025-01-01', N'신정', 'LEGAL', 2025),
        ('2025-01-28', N'설날연휴', 'LEGAL', 2025),
        ('2025-01-29', N'설날', 'LEGAL', 2025),
        ('2025-01-30', N'설날연휴', 'LEGAL', 2025),
        ('2025-03-01', N'삼일절', 'LEGAL', 2025),
        ('2025-05-05', N'어린이날', 'LEGAL', 2025),
        ('2025-05-06', N'부처님오신날', 'LEGAL', 2025),
        ('2025-06-06', N'현충일', 'LEGAL', 2025),
        ('2025-08-12', N'창립기념일', 'COMPANY', 2025),
        ('2025-08-15', N'광복절', 'LEGAL', 2025),
        ('2025-10-03', N'개천절', 'LEGAL', 2025),
        ('2025-10-05', N'추석연휴', 'LEGAL', 2025),
        ('2025-10-06', N'추석', 'LEGAL', 2025),
        ('2025-10-07', N'추석연휴', 'LEGAL', 2025),
        ('2025-10-08', N'대체공휴일', 'LEGAL', 2025),
        ('2025-10-09', N'한글날', 'LEGAL', 2025),
        ('2025-12-25', N'성탄절', 'LEGAL', 2025)
    """
    )


def downgrade() -> None:
    op.execute("DELETE FROM holidays")
    op.execute("DELETE FROM common_codes")
    op.execute("DELETE FROM job_positions")
    op.execute("DELETE FROM sub_teams")
    op.execute("DELETE FROM departments")
    op.execute("DELETE FROM project_types")
    op.execute("DELETE FROM business_units")
