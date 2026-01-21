"""
Import Manual Classification Results

Reads a manually classified CSV file and updates the database.
Supports dry-run mode for safety.

Usage:
    # Dry run (preview)
    python import_manual_classification.py <csv_file>

    # Execute
    python import_manual_classification.py <csv_file> --execute --i-have-backed-up
"""

import sys
import os
import csv
import argparse
import logging
from datetime import datetime

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_session_local
from app.models.project import Project

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def validate_values(row, row_num):
    """Validate classification values"""
    errors = []

    # Validate funding_entity_id
    valid_funding = ['ENTITY_VSS', 'ENTITY_SUN', 'ENTITY_LOCAL_KR', 'ENTITY_SHARED', '']
    if row['funding_entity_id'] not in valid_funding:
        errors.append(f"Invalid funding_entity_id: {row['funding_entity_id']}")

    # Validate recharge_status
    valid_recharge = ['BILLABLE', 'NON_BILLABLE', 'INTERNAL', '']
    if row['recharge_status'] not in valid_recharge:
        errors.append(f"Invalid recharge_status: {row['recharge_status']}")

    # Validate io_category_code
    valid_category = ['NPI', 'FIELD_FAILURE', 'OPS_SUPPORT', 'SUSTAINING', 'CIP', 'OTHER', '']
    if row['io_category_code'] not in valid_category:
        errors.append(f"Invalid io_category_code: {row['io_category_code']}")

    # Validate is_capitalizable
    valid_capital = ['TRUE', 'FALSE', 'True', 'False', 'true', 'false', '']
    if row['is_capitalizable'] not in valid_capital:
        errors.append(f"Invalid is_capitalizable: {row['is_capitalizable']}")

    if errors:
        logger.error(f"Row {row_num} validation errors for project {row['project_code']}: {', '.join(errors)}")
        return False

    return True

def main():
    parser = argparse.ArgumentParser(description="Import manual classification results")
    parser.add_argument('csv_file', help='Path to the manually classified CSV file')
    parser.add_argument('--execute', action='store_true', help='Execute the updates (default is dry-run)')
    parser.add_argument('--i-have-backed-up', action='store_true', help='Confirm database backup')
    args = parser.parse_args()

    # Safety check
    if args.execute and not args.i_have_backed_up:
        logger.error("")
        logger.error("=" * 80)
        logger.error("⚠️  SAFETY CHECK FAILED")
        logger.error("=" * 80)
        logger.error("")
        logger.error("Before running with --execute, ensure you have backed up the database.")
        logger.error("Run with: --execute --i-have-backed-up")
        logger.error("")
        sys.exit(1)

    logger.info("=" * 80)
    logger.info("MANUAL CLASSIFICATION IMPORT")
    logger.info("=" * 80)
    logger.info(f"CSV File: {args.csv_file}")
    logger.info(f"Mode: {'EXECUTE' if args.execute else 'DRY RUN'}")
    logger.info("")

    # Check if file exists
    if not os.path.exists(args.csv_file):
        logger.error(f"File not found: {args.csv_file}")
        sys.exit(1)

    # Read CSV
    logger.info("Reading CSV file...")
    classifications = []
    validation_errors = 0

    with open(args.csv_file, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is 1)
            if validate_values(row, row_num):
                classifications.append(row)
            else:
                validation_errors += 1

    logger.info(f"Loaded {len(classifications)} valid classifications")
    if validation_errors > 0:
        logger.error(f"Found {validation_errors} validation errors - please fix them in the CSV")
        sys.exit(1)

    # Apply to database
    SessionLocal = get_session_local()
    db = SessionLocal()

    stats = {
        'total': len(classifications),
        'updated': 0,
        'skipped': 0,
        'errors': 0
    }

    try:
        for row in classifications:
            try:
                # Find project by ID
                project = db.query(Project).filter(Project.id == row['project_id']).first()

                if not project:
                    logger.warning(f"Project not found: {row['project_code']} ({row['project_id']})")
                    stats['skipped'] += 1
                    continue

                # Check if values are provided (not empty)
                has_changes = False

                if row['funding_entity_id']:
                    old_value = project.funding_entity_id
                    new_value = row['funding_entity_id']
                    if old_value != new_value:
                        if args.execute:
                            project.funding_entity_id = new_value
                        logger.info(f"{row['project_code']}: funding_entity_id: {old_value} → {new_value}")
                        has_changes = True

                if row['recharge_status']:
                    old_value = project.recharge_status
                    new_value = row['recharge_status']
                    if old_value != new_value:
                        if args.execute:
                            project.recharge_status = new_value
                        logger.debug(f"{row['project_code']}: recharge_status: {old_value} → {new_value}")
                        has_changes = True

                if row['io_category_code']:
                    old_value = project.io_category_code
                    new_value = row['io_category_code']
                    if old_value != new_value:
                        if args.execute:
                            project.io_category_code = new_value
                        logger.debug(f"{row['project_code']}: io_category_code: {old_value} → {new_value}")
                        has_changes = True

                if row['is_capitalizable']:
                    old_value = project.is_capitalizable
                    new_value = row['is_capitalizable'].upper() == 'TRUE'
                    if old_value != new_value:
                        if args.execute:
                            project.is_capitalizable = new_value
                        logger.debug(f"{row['project_code']}: is_capitalizable: {old_value} → {new_value}")
                        has_changes = True

                if has_changes:
                    stats['updated'] += 1
                else:
                    stats['skipped'] += 1

            except Exception as e:
                logger.error(f"Error processing project {row['project_code']}: {e}")
                stats['errors'] += 1

        # Commit if execute mode
        if args.execute:
            logger.info("")
            logger.info("Committing changes to database...")
            db.commit()
            logger.info("✅ Changes committed")
        else:
            logger.info("")
            logger.info("🔍 Dry run mode - no changes committed")

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

    # Print summary
    logger.info("")
    logger.info("=" * 80)
    logger.info("IMPORT SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Total projects: {stats['total']}")
    logger.info(f"Updated: {stats['updated']}")
    logger.info(f"Skipped (no changes): {stats['skipped']}")
    logger.info(f"Errors: {stats['errors']}")
    logger.info("")

    if not args.execute:
        logger.info("ℹ️  Run with --execute --i-have-backed-up to apply changes")

if __name__ == "__main__":
    main()
