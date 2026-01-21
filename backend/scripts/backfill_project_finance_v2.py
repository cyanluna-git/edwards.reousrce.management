"""
Project Financial Data Backfill Script (v2.0)

Intelligently backfills financial attributes for existing projects using
the ProjectClassifier service. Generates detailed audit reports and supports
dry-run mode for safe verification before execution.

Usage:
    # Dry run (default) - preview changes without committing
    python backend/scripts/backfill_project_finance_v2.py

    # Execute actual database update
    python backend/scripts/backfill_project_finance_v2.py --execute

    # Execute with backup confirmation
    python backend/scripts/backfill_project_finance_v2.py --execute --i-have-backed-up

Author: Edwards Engineering Team
Date: 2026-01-21
Version: 2.0
"""

import sys
import os
import csv
import logging
import argparse
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy import or_
from logging.handlers import RotatingFileHandler

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_session_local
from app.models.project import Project
from app.services.project_classifier import ProjectClassifier, ClassificationResult

# Configure logging with rotation
log_dir = os.path.join(os.path.dirname(__file__), '..', 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, 'backfill_project_finance.log')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5)  # 10MB per file, keep 5 backups
    ]
)
logger = logging.getLogger(__name__)


class ProjectFinanceBackfiller:
    """
    Backfill manager for project financial data.

    Handles:
    - Database queries with proper filtering
    - Classification using ProjectClassifier service
    - CSV report generation
    - Transaction management
    - Progress tracking
    """

    def __init__(self, dry_run: bool = True, skip_low_confidence: bool = False):
        """
        Initialize backfiller.

        Args:
            dry_run: If True, don't commit changes to database
            skip_low_confidence: If True, skip updating projects with low confidence
        """
        self.dry_run = dry_run
        self.skip_low_confidence = skip_low_confidence
        self.classifier = ProjectClassifier()
        self.results: List[Dict[str, Any]] = []

    def run(self) -> Dict[str, int]:
        """
        Execute the backfill process.

        Returns:
            Dictionary with statistics (total, updated, skipped, errors)
        """
        logger.info("=" * 80)
        logger.info("PROJECT FINANCIAL DATA BACKFILL - v2.0")
        logger.info("=" * 80)
        logger.info(f"Mode: {'DRY RUN (no changes will be committed)' if self.dry_run else 'EXECUTE (changes will be committed)'}")
        logger.info(f"Skip low confidence: {self.skip_low_confidence}")
        logger.info("")

        SessionLocal = get_session_local()
        db = SessionLocal()
        stats = {
            "total": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 0,
            "low_confidence": 0
        }

        # Batch processing configuration
        BATCH_SIZE = 100
        COMMIT_INTERVAL = 50
        PROGRESS_LOG_INTERVAL = 10

        try:
            # Count total projects first (more efficient than .all())
            total_count = db.query(Project).filter(
                or_(
                    Project.funding_entity_id.is_(None),
                    Project.funding_entity_id == ''
                )
            ).count()

            stats["total"] = total_count
            logger.info(f"Found {stats['total']} projects to classify")
            logger.info("")

            # Process projects in batches to avoid memory issues
            offset = 0
            idx = 0

            while offset < total_count:
                # Fetch batch
                batch = db.query(Project).filter(
                    or_(
                        Project.funding_entity_id.is_(None),
                        Project.funding_entity_id == ''
                    )
                ).limit(BATCH_SIZE).offset(offset).all()

                if not batch:
                    break

                # Process each project in batch
                for project in batch:
                    idx += 1
                    try:
                        # Log progress periodically
                        if idx % PROGRESS_LOG_INTERVAL == 0 or idx == 1:
                            logger.info(f"Processing project {idx}/{stats['total']}...")

                        # Classify the project
                        result = self.classifier.classify(
                            project_code=project.code,
                            project_name=project.name,
                            project_type_id=project.project_type_id
                        )

                        # Store current values for audit report (consistent null handling)
                        old_funding = project.funding_entity_id if project.funding_entity_id else "NULL"
                        old_recharge = project.recharge_status if project.recharge_status else "NULL"
                        old_category = project.io_category_code if project.io_category_code else "NULL"
                        old_capitalizable = str(project.is_capitalizable) if project.is_capitalizable is not None else "NULL"

                        # Determine if we should update this project
                        should_update = True
                        skip_reason = None

                        if result.requires_manual_review and self.skip_low_confidence:
                            should_update = False
                            skip_reason = "Low confidence - manual review required"
                            stats["low_confidence"] += 1

                        # Apply updates if not in dry-run mode and should update
                        if should_update and not self.dry_run:
                            project.funding_entity_id = result.funding_entity_id
                            project.recharge_status = result.recharge_status
                            project.io_category_code = result.io_category_code
                            project.is_capitalizable = result.is_capitalizable
                            stats["updated"] += 1

                            # Log individual update
                            logger.debug(
                                f"Updated project {project.code}: "
                                f"funding={result.funding_entity_id}, "
                                f"recharge={result.recharge_status}, "
                                f"confidence={result.confidence.value}"
                            )
                        elif should_update and self.dry_run:
                            stats["updated"] += 1  # Count as "would update"
                        else:
                            stats["skipped"] += 1

                        # Add to results for CSV report
                        self.results.append({
                            "project_id": project.id,
                            "project_code": project.code,
                            "project_name": project.name,
                            "project_type": project.project_type_id or "NULL",
                            "old_funding_entity": old_funding,
                            "new_funding_entity": result.funding_entity_id,
                            "old_recharge_status": old_recharge,
                            "new_recharge_status": result.recharge_status,
                            "old_io_category": old_category,
                            "new_io_category": result.io_category_code,
                            "old_capitalizable": old_capitalizable,
                            "new_capitalizable": str(result.is_capitalizable),
                            "confidence": result.confidence.value,
                            "reason": result.reason,
                            "status": skip_reason if skip_reason else ("DRY_RUN" if self.dry_run else "UPDATED")
                        })

                        # Warn on low confidence
                        if result.requires_manual_review:
                            logger.warning(
                                f"Low confidence for project {project.code}: {result.reason}"
                            )

                    except Exception as e:
                        # Safe error handling with locals() check
                        project_id = project.id if 'project' in locals() and hasattr(project, 'id') else "UNKNOWN"
                        project_code = project.code if 'project' in locals() and hasattr(project, 'code') else "UNKNOWN"
                        logger.error(f"Error processing project {project_code}: {e}")
                        stats["errors"] += 1
                        self.results.append({
                            "project_id": project_id,
                            "project_code": project_code,
                            "project_name": project.name if 'project' in locals() and hasattr(project, 'name') else "UNKNOWN",
                            "project_type": "ERROR",
                            "old_funding_entity": "ERROR",
                            "new_funding_entity": "ERROR",
                            "old_recharge_status": "ERROR",
                            "new_recharge_status": "ERROR",
                            "old_io_category": "ERROR",
                            "new_io_category": "ERROR",
                            "old_capitalizable": "ERROR",
                            "new_capitalizable": "ERROR",
                            "confidence": "ERROR",
                            "reason": str(e),
                            "status": "ERROR"
                        })

                # Commit at intervals (batch commits for safety)
                if not self.dry_run and (idx % COMMIT_INTERVAL == 0):
                    db.commit()
                    logger.info(f"✅ Checkpoint: Committed changes up to project {idx}")

                # Move to next batch
                offset += BATCH_SIZE

            # Final commit if not dry run
            if not self.dry_run:
                logger.info("")
                logger.info("Committing final changes to database...")
                db.commit()
                logger.info("✅ All changes committed successfully")
            else:
                logger.info("")
                logger.info("🔍 Dry run mode - no changes committed")

        except Exception as e:
            logger.error(f"Fatal error during backfill: {e}")
            db.rollback()
            raise
        finally:
            db.close()

        # Generate CSV report
        self._generate_report()

        # Print summary
        logger.info("")
        logger.info("=" * 80)
        logger.info("BACKFILL SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total projects processed: {stats['total']}")
        logger.info(f"Projects {'updated' if not self.dry_run else 'to update'}: {stats['updated']}")
        logger.info(f"Projects skipped: {stats['skipped']}")
        logger.info(f"Low confidence (needs review): {stats['low_confidence']}")
        logger.info(f"Errors: {stats['errors']}")
        logger.info("")

        if self.dry_run:
            logger.info("ℹ️  Run with --execute to apply these changes")
        else:
            logger.info("✅ Backfill completed successfully")

        return stats

    def _generate_report(self) -> str:
        """
        Generate CSV report of all classification results.

        Returns:
            Path to generated CSV file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Use absolute path in reports directory
        reports_dir = os.path.join(os.path.dirname(__file__), '..', 'reports')
        os.makedirs(reports_dir, exist_ok=True)
        report_path = os.path.join(reports_dir, f"migration_report_{timestamp}.csv")

        logger.info("")
        logger.info(f"Generating CSV report: {report_path}")

        # Check if there are results before opening file
        if not self.results:
            logger.warning("No results to write to CSV")
            return report_path

        try:
            with open(report_path, 'w', newline='', encoding='utf-8') as csvfile:
                fieldnames = list(self.results[0].keys())
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

                writer.writeheader()
                writer.writerows(self.results)

            logger.info(f"✅ Report generated: {report_path}")
            logger.info(f"   Total records: {len(self.results)}")

        except Exception as e:
            logger.error(f"Error generating CSV report: {e}")
            raise

        return report_path


def main():
    """Main entry point for the backfill script"""
    parser = argparse.ArgumentParser(
        description="Backfill project financial data (v2.0)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Preview changes without committing (safe)
  python backfill_project_finance_v2.py

  # Execute actual database update
  python backfill_project_finance_v2.py --execute

  # Execute with backup confirmation
  python backfill_project_finance_v2.py --execute --i-have-backed-up

  # Skip low confidence matches (require manual review)
  python backfill_project_finance_v2.py --execute --skip-low-confidence
        """
    )

    parser.add_argument(
        '--execute',
        action='store_true',
        help='Actually execute the changes (default is dry-run mode)'
    )

    parser.add_argument(
        '--i-have-backed-up',
        action='store_true',
        help='Confirmation that you have backed up the database'
    )

    parser.add_argument(
        '--skip-low-confidence',
        action='store_true',
        help='Skip updating projects with low confidence classifications'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose (DEBUG) logging'
    )

    args = parser.parse_args()

    # Set logging level
    if args.verbose:
        logger.setLevel(logging.DEBUG)

    # Safety check for execute mode
    if args.execute and not args.i_have_backed_up:
        logger.error("")
        logger.error("=" * 80)
        logger.error("⚠️  SAFETY CHECK FAILED")
        logger.error("=" * 80)
        logger.error("")
        logger.error("Before running with --execute, please ensure you have:")
        logger.error("  1. Backed up the database")
        logger.error("  2. Reviewed the dry-run output")
        logger.error("  3. Verified the classification rules are correct")
        logger.error("")
        logger.error("If you have completed these steps, run with:")
        logger.error("  python backfill_project_finance_v2.py --execute --i-have-backed-up")
        logger.error("")
        sys.exit(1)

    # Run backfiller
    try:
        backfiller = ProjectFinanceBackfiller(
            dry_run=not args.execute,
            skip_low_confidence=args.skip_low_confidence
        )
        stats = backfiller.run()

        # Exit with non-zero code if there were errors
        if stats["errors"] > 0:
            sys.exit(1)

    except Exception as e:
        logger.exception("Fatal error during backfill execution")
        sys.exit(1)


if __name__ == "__main__":
    main()
