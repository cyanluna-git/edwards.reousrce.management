"""
Generate Manual Classification Template

Creates a detailed CSV file with all project information to help with manual classification.
Includes: project info, program, product line, customer, PM, etc.
"""

import sys
import os
import csv
from datetime import datetime

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_session_local
from app.models.project import Project
from sqlalchemy import or_

def main():
    print("=" * 80)
    print("MANUAL CLASSIFICATION TEMPLATE GENERATOR")
    print("=" * 80)
    print()

    SessionLocal = get_session_local()
    db = SessionLocal()

    try:
        # Query all projects with NULL funding_entity_id
        print("Querying projects for manual classification...")
        projects = db.query(Project).filter(
            or_(
                Project.funding_entity_id.is_(None),
                Project.funding_entity_id == ''
            )
        ).all()

        print(f"Found {len(projects)} projects")
        print()

        # Generate template file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        template_path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'reports',
            f'manual_classification_template_{timestamp}.csv'
        )

        print(f"Generating template: {template_path}")

        with open(template_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'project_id',
                'project_code',
                'project_name',
                'project_type',
                'program_code',
                'program_name',
                'product_line_code',
                'product_line_name',
                'customer',
                'pm_name',
                'status',
                'start_month',
                'end_month',
                'description',
                # Manual classification fields (to be filled)
                'funding_entity_id',  # Fill: ENTITY_VSS, ENTITY_SUN, ENTITY_LOCAL_KR, ENTITY_SHARED
                'recharge_status',    # Fill: BILLABLE, NON_BILLABLE, INTERNAL
                'io_category_code',   # Fill: NPI, FIELD_FAILURE, OPS_SUPPORT, SUSTAINING, CIP, OTHER
                'is_capitalizable',   # Fill: TRUE, FALSE
                'notes'               # Fill: any notes about the classification
            ]

            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()

            for project in projects:
                # Get related information
                program_code = project.program.id if project.program else ""
                program_name = project.program.name if project.program else ""
                product_line_code = project.product_line.code if project.product_line else ""
                product_line_name = project.product_line.name if project.product_line else ""
                pm_name = project.pm.name if project.pm else ""

                # Suggested values based on project type
                if project.project_type_id == 'NPI':
                    suggested_funding = 'ENTITY_LOCAL_KR'
                    suggested_recharge = 'NON_BILLABLE'
                    suggested_category = 'NPI'
                    suggested_capital = 'TRUE'
                elif project.project_type_id == 'SUSTAINING':
                    suggested_funding = 'ENTITY_VSS'
                    suggested_recharge = 'BILLABLE'
                    suggested_category = 'SUSTAINING'
                    suggested_capital = 'TRUE'
                elif project.project_type_id == 'SUPPORT':
                    suggested_funding = 'ENTITY_VSS'
                    suggested_recharge = 'BILLABLE'
                    suggested_category = 'OPS_SUPPORT'
                    suggested_capital = 'FALSE'
                else:
                    suggested_funding = 'ENTITY_LOCAL_KR'
                    suggested_recharge = 'INTERNAL'
                    suggested_category = 'OTHER'
                    suggested_capital = 'FALSE'

                writer.writerow({
                    'project_id': project.id,
                    'project_code': project.code,
                    'project_name': project.name,
                    'project_type': project.project_type_id or '',
                    'program_code': program_code,
                    'program_name': program_name,
                    'product_line_code': product_line_code,
                    'product_line_name': product_line_name,
                    'customer': project.customer or '',
                    'pm_name': pm_name,
                    'status': project.status or '',
                    'start_month': project.start_month or '',
                    'end_month': project.end_month or '',
                    'description': (project.description or '')[:100],  # Truncate long descriptions
                    # Pre-filled suggestions (can be edited)
                    'funding_entity_id': suggested_funding,
                    'recharge_status': suggested_recharge,
                    'io_category_code': suggested_category,
                    'is_capitalizable': suggested_capital,
                    'notes': ''
                })

        print(f"✅ Template generated: {template_path}")
        print()
        print("=" * 80)
        print("NEXT STEPS")
        print("=" * 80)
        print()
        print("1. Open the CSV file in Excel or Google Sheets")
        print("2. Review and edit the classification fields:")
        print("   - funding_entity_id: ENTITY_VSS, ENTITY_SUN, ENTITY_LOCAL_KR, ENTITY_SHARED")
        print("   - recharge_status: BILLABLE, NON_BILLABLE, INTERNAL")
        print("   - io_category_code: NPI, FIELD_FAILURE, OPS_SUPPORT, SUSTAINING, CIP, OTHER")
        print("   - is_capitalizable: TRUE, FALSE")
        print("3. Save the file (keep the same name)")
        print("4. Run the import script:")
        print(f"   DATABASE_URL=\"postgresql://postgres:password@localhost:5434/edwards\" \\")
        print(f"   .venv/bin/python backend/scripts/import_manual_classification.py \\")
        print(f"   {template_path}")
        print()

    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
