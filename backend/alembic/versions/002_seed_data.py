"""Seed initial data - CommonCodes, BusinessUnits, ProjectTypes, Holidays

Revision ID: 002_seed_data
Revises: 001_initial_schema
Create Date: 2024-12-10

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from datetime import datetime
import uuid


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

    # === Seed Programs and Projects from sample data ===
    programs_table = sa.table('programs',
        sa.column('id', sa.String),
        sa.column('name', sa.String),
        sa.column('business_unit_id', sa.String),
        sa.column('is_active', sa.Boolean)
    )
    
    projects_table = sa.table('projects',
        sa.column('id', sa.String),
        sa.column('program_id', sa.String),
        sa.column('project_type_id', sa.String),
        sa.column('code', sa.String),
        sa.column('name', sa.String),
        sa.column('status', sa.String),
        sa.column('complexity', sa.String),
        sa.column('customer', sa.String),
        sa.column('product', sa.String),
        sa.column('description', sa.Text)
    )

    sample_project_data = [
        {"name": "Gen3+, HRSD, H2D-HP x 2, HVM", "program": "EUV NPI", "description": "SRC 6 + EXP 2 + HRSD + H2D-HP x 2", "product": "IEB3J0624010", "code": "406372", "customer": "TSMC HVM", "status": "WIP", "category": "NPI Project", "complexity": "Simple NPI"},
        {"name": "2025 Ruby - SIC integration", "program": "IS NPI", "description": "2025 사용 : 406397 Ruby - Sic integration", "product": "Ruby", "code": "406397", "customer": "", "status": "WIP", "category": "NPI Project", "complexity": "Simple NPI"},
        {"name": "2025 Havasu", "program": "IS NPI", "description": "2025 사용 : 406399 Havasu", "product": "Havasu", "code": "406399", "customer": "TEL", "status": "WIP", "category": "NPI Project", "complexity": "Complex NPI"},
        {"name": "2025 High Performance H2D (1000slm)", "program": "IS NPI", "description": "2025 사용 : 406365 High Performance H2D (1000slm)", "product": "H2D-HP", "code": "406365", "customer": "", "status": "WIP", "category": "NPI Project", "complexity": "Derivative NPI"},
        {"name": "General/Non-Project", "program": "General/Functional", "description": "Functional Team, 교육, Intenal Project 수행", "product": "", "code": "N/A", "customer": "", "status": "WIP", "category": "", "complexity": ""},
        {"name": "EUV ETO Support", "program": "General/Functional", "description": "EUV의 ETO Project 들 관련 업무 수행", "product": "", "code": "404721", "customer": "", "status": "WIP", "category": "Support", "complexity": ""},
        {"name": "ReGIS Mk3", "program": "IS NPI", "description": "", "product": "", "code": "406364", "customer": "", "status": "Hold", "category": "NPI Project", "complexity": "Simple NPI"},
        {"name": "2025 EUV Gen4 Phase 1 Tumalo", "program": "IS NPI", "description": "2025 사용 : 406437 EUV Gen4 Phase 1 Tumalo", "product": "Vizeon", "code": "406437", "customer": "", "status": "WIP", "category": "NPI Project", "complexity": "Complex NPI"},
        {"name": "NKB963, EXP3, Nova x 4", "program": "IS NPI", "description": "NKB963000, SRC 8 + EXP 3 + Nova x 4", "product": "NKB963000", "code": "406372", "customer": "Samsung", "status": "WIP", "category": "NPI Project", "complexity": "Derivative NPI"},
        {"name": "Gen4, Kanarra", "program": "EUV NPI", "description": "", "product": "Kanarra", "code": "406376", "customer": "", "status": "Hold", "category": "NPI Project", "complexity": "Complex NPI"},
        {"name": "iARECA Single ETO Request for TEL Korea GCS", "program": "Abatement ETO", "description": "Create new iARECA model for other site", "product": "IA1SO", "code": "406428", "customer": "Tel Korea", "status": "WIP", "category": "ETO Project", "complexity": ""},
        {"name": "EUV TSMC Gen2 APM mode upgrade", "program": "EUV ETO", "description": "Upgrade kit for BPV control by H2 disabled signal", "product": "NKB898000", "code": "", "customer": "TSMC", "status": "Forecast", "category": "ETO Project", "complexity": ""},
        {"name": "2025 BCD", "program": "ACM NPI", "description": "2025 사용 : 406646 ACM BCD(Bulk Chemical Delivery) Project", "product": "BCD & VMB", "code": "406646", "customer": "SEC", "status": "WIP", "category": "A&D", "complexity": ""},
    ]

    programs_to_insert = {}
    projects_to_insert = []
    used_codes = set()
    
    category_to_project_type = {
        'NPI Project': 'NPI', 'ETO Project': 'ETO', 'Support': 'SUPPORT',
        'Internal Project': 'INTERNAL', 'Team Task': 'INTERNAL', 'Legacy': 'INTERNAL',
        'Sustaining': 'SUPPORT', 'A&D': 'NPI', '': 'INTERNAL'
    }

    for row in sample_project_data:
        program_name = row['program'].strip()
        if program_name and program_name not in programs_to_insert:
            program_id = program_name.upper().replace(' ', '_').replace('/', '_').replace('-', '_')
            programs_to_insert[program_name] = {
                'id': program_id, 'name': program_name,
                'business_unit_id': 'BU_SHARED', 'is_active': True
            }

        project_code = row['code'].strip()
        if not project_code or project_code == 'N/A' or project_code in used_codes:
            continue
        
        used_codes.add(project_code)

        prog_id = programs_to_insert.get(program_name, {}).get('id')
        cat = row.get('category', '').strip()
        proj_type_id = category_to_project_type.get(cat, 'INTERNAL')

        projects_to_insert.append({
            'id': str(uuid.uuid4()), 'program_id': prog_id, 'project_type_id': proj_type_id,
            'code': project_code, 'name': row['name'].strip(),
            'status': row['status'].strip() if row.get('status') else 'Forecast',
            'complexity': row['complexity'].strip() if row.get('complexity') else None,
            'customer': row['customer'].strip() if row.get('customer') else None,
            'product': row['product'].strip() if row.get('product') else None,
            'description': row['description'].strip() if row.get('description') else None,
        })

    if programs_to_insert:
        op.bulk_insert(programs_table, list(programs_to_insert.values()))
    
    if projects_to_insert:
        op.bulk_insert(projects_table, projects_to_insert)

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
    # This is a simplified downgrade, it does not re-create projects/programs
    op.execute("DELETE FROM projects")
    op.execute("DELETE FROM programs")
    op.execute("DELETE FROM holidays")
    op.execute("DELETE FROM common_codes")
    op.execute("DELETE FROM job_positions")
    op.execute("DELETE FROM sub_teams")
    op.execute("DELETE FROM departments")
    op.execute("DELETE FROM project_types")
    op.execute("DELETE FROM business_units")