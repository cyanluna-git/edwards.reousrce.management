"""
CSV Migration Service for Worklog Import

Main orchestrator for CSV worklog migration:
1. Load and parse CSV files
2. Filter by date range
3. Resolve User/Project/WorkType mappings
4. Check for duplicates
5. Insert new worklogs or generate dry-run report

Usage:
    from app.services.csv_migration_service import CSVMigrationService

    service = CSVMigrationService(db_session)
    await service.load_csv_data(backup_path)
    result = await service.analyze(days=-7)
    result = await service.execute(days=-7, dry_run=True)
"""

import csv
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import json

from sqlalchemy.orm import Session

from .user_resolver import UserResolver, ResolutionStatus
from .project_resolver import ProjectResolver
from .worktype_resolver import WorkTypeResolver


class MigrationStatus(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    RESOLVED = "resolved"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class WorklogRecord:
    """Parsed worklog record from CSV."""
    csv_id: str
    date: datetime
    hours: float
    title: str
    person_id: str
    project_id: str
    worktype_id: str
    is_sudden: bool
    is_business_trip: bool
    meeting_type: Optional[str]

    # Resolved mappings
    user_uuid: Optional[str] = None
    project_uuid: Optional[str] = None
    worktype_uuid: Optional[str] = None

    # Confidence scores
    user_confidence: float = 0.0
    project_confidence: float = 0.0
    worktype_confidence: float = 0.0

    # Flags
    is_duplicate: bool = False
    needs_review: bool = False
    error: Optional[str] = None


@dataclass
class MigrationReport:
    """Migration analysis and execution report."""
    status: MigrationStatus
    timestamp: datetime
    date_range: Tuple[datetime, datetime]

    # Counts
    total_records: int = 0
    filtered_records: int = 0
    duplicate_records: int = 0
    resolved_records: int = 0
    low_confidence_records: int = 0
    unresolved_records: int = 0
    inserted_records: int = 0
    skipped_records: int = 0

    # Breakdown by resolver
    user_stats: Dict[str, int] = field(default_factory=dict)
    project_stats: Dict[str, int] = field(default_factory=dict)
    worktype_stats: Dict[str, int] = field(default_factory=dict)

    # Lists for review
    unresolved_users: List[Dict] = field(default_factory=list)
    unresolved_projects: List[Dict] = field(default_factory=list)
    low_confidence_items: List[Dict] = field(default_factory=list)

    errors: List[str] = field(default_factory=list)


class CSVMigrationService:
    """
    CSV Worklog Migration Service.

    Orchestrates the entire migration process:
    1. Load CSV data (db_users.csv, db_projects.csv, db_worktype.csv, tb_worklog.csv)
    2. Load DB data (users, projects, work_types)
    3. Filter worklogs by date range
    4. Resolve mappings using resolver services
    5. Check for duplicates
    6. Execute migration (dry-run or actual)
    """

    # Date parsing formats
    DATE_FORMATS = [
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%m/%d/%Y",
    ]

    def __init__(self, db: Optional[Session] = None):
        self.db = db
        self.user_resolver = UserResolver()
        self.project_resolver = ProjectResolver()
        self.worktype_resolver = WorkTypeResolver()

        # CSV data
        self.csv_users: List[Dict] = []
        self.csv_projects: List[Dict] = []
        self.csv_worktypes: List[Dict] = []
        self.csv_worklogs: List[Dict] = []

        # Parsed worklogs
        self.worklogs: List[WorklogRecord] = []

        # Duplicate detection cache
        self.existing_keys: set = set()

        # Report
        self.report: Optional[MigrationReport] = None

    def load_csv_data(self, backup_path: str) -> None:
        """
        Load CSV data from backup folder.

        Expected files:
        - db_users.csv
        - db_projects.csv
        - db_worktype.csv
        - tb_worklog.csv
        """
        backup_dir = Path(backup_path)

        # Load reference tables
        self.csv_users = self._read_csv(backup_dir / "db_users.csv")
        self.csv_projects = self._read_csv(backup_dir / "db_projects.csv")
        self.csv_worktypes = self._read_csv(backup_dir / "db_worktype.csv")

        # Load worklogs
        self.csv_worklogs = self._read_csv(backup_dir / "tb_worklog.csv")

        # Initialize resolvers with CSV data
        self.user_resolver.load_csv_mappings(self.csv_users)
        self.project_resolver.load_csv_mappings(self.csv_projects)

    def load_db_data(
        self,
        users: List[Dict],
        projects: List[Dict],
        work_types: List[Dict],
    ) -> None:
        """Load DB data for resolvers."""
        self.user_resolver.load_db_users(users)
        self.project_resolver.load_db_projects(projects)
        self.worktype_resolver.load_db_work_types(work_types)

    def load_existing_worklogs(self, worklogs: List[Dict]) -> None:
        """Load existing worklogs for duplicate detection."""
        for w in worklogs:
            key = self._make_worklog_key(
                user_id=w.get("user_id"),
                project_id=w.get("project_id"),
                date=w.get("date"),
                hours=w.get("hours"),
            )
            self.existing_keys.add(key)

    def _read_csv(self, filepath: Path) -> List[Dict]:
        """Read CSV file with encoding detection."""
        if not filepath.exists():
            return []

        # Try different encodings
        for encoding in ["utf-16", "utf-8-sig", "utf-8", "cp949", "euc-kr"]:
            try:
                with open(filepath, "r", encoding=encoding) as f:
                    # Try to read first line to detect delimiter
                    first_line = f.readline()
                    f.seek(0)

                    delimiter = "\t" if "\t" in first_line else ","
                    reader = csv.DictReader(f, delimiter=delimiter)
                    return list(reader)
            except (UnicodeDecodeError, UnicodeError):
                continue

        return []

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string with multiple format support."""
        if not date_str:
            return None

        date_str = date_str.strip()

        for fmt in self.DATE_FORMATS:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        return None

    def _parse_bool(self, value: str) -> bool:
        """Parse boolean string."""
        if not value:
            return False
        return value.upper() in ("TRUE", "1", "YES", "Y")

    def _parse_float(self, value: str) -> float:
        """Parse float string."""
        if not value:
            return 0.0
        try:
            return float(value)
        except ValueError:
            return 0.0

    def _make_worklog_key(
        self,
        user_id: str,
        project_id: str,
        date: Any,
        hours: Any,
    ) -> str:
        """Create composite key for duplicate detection."""
        date_str = date.strftime("%Y-%m-%d") if isinstance(date, datetime) else str(date)
        return f"{user_id}|{project_id}|{date_str}|{hours}"

    def analyze(
        self,
        days: int = -7,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> MigrationReport:
        """
        Analyze CSV worklogs and generate migration report.

        Args:
            days: Number of days to look back (negative value)
            start_date: Optional explicit start date
            end_date: Optional explicit end date

        Returns:
            MigrationReport with analysis results
        """
        # Calculate date range
        if start_date and end_date:
            date_from = start_date
            date_to = end_date
        else:
            date_to = datetime.now()
            date_from = date_to + timedelta(days=days)

        self.report = MigrationReport(
            status=MigrationStatus.ANALYZING,
            timestamp=datetime.now(),
            date_range=(date_from, date_to),
            total_records=len(self.csv_worklogs),
        )

        # Parse and filter worklogs
        self.worklogs = []
        for row in self.csv_worklogs:
            record = self._parse_worklog_row(row)
            if not record:
                continue

            # Filter by date range
            if record.date < date_from or record.date > date_to:
                continue

            self.worklogs.append(record)

        self.report.filtered_records = len(self.worklogs)

        # Resolve mappings
        for record in self.worklogs:
            self._resolve_mappings(record)

            # Check for duplicates
            if record.user_uuid and record.project_uuid:
                key = self._make_worklog_key(
                    user_id=record.user_uuid,
                    project_id=record.project_uuid,
                    date=record.date,
                    hours=record.hours,
                )
                if key in self.existing_keys:
                    record.is_duplicate = True
                    self.report.duplicate_records += 1

            # Categorize result
            if record.error:
                self.report.unresolved_records += 1
            elif record.needs_review:
                self.report.low_confidence_records += 1
                self.report.low_confidence_items.append({
                    "csv_id": record.csv_id,
                    "title": record.title,
                    "user_confidence": record.user_confidence,
                    "project_confidence": record.project_confidence,
                })
            else:
                self.report.resolved_records += 1

        # Collect resolver stats
        self.report.user_stats = self.user_resolver.get_stats()
        self.report.project_stats = self.project_resolver.get_stats()
        self.report.worktype_stats = self.worktype_resolver.get_stats()

        self.report.status = MigrationStatus.RESOLVED
        return self.report

    def _parse_worklog_row(self, row: Dict) -> Optional[WorklogRecord]:
        """Parse a single worklog CSV row."""
        try:
            date = self._parse_date(row.get("Date", ""))
            if not date:
                return None

            hours = self._parse_float(row.get("Hours", "0"))
            if hours <= 0:
                return None

            return WorklogRecord(
                csv_id=row.get("Id", ""),
                date=date,
                hours=hours,
                title=row.get("Title", ""),
                person_id=row.get("Createdby.Id", ""),
                project_id=row.get("Project.Id", ""),
                worktype_id=row.get("Worktype.Id", ""),
                is_sudden=self._parse_bool(row.get("SuddenWork?", "")),
                is_business_trip=self._parse_bool(row.get("BusinessTrip", "")),
                meeting_type=row.get("MeetingType") or None,
            )
        except Exception as e:
            return None

    def _resolve_mappings(self, record: WorklogRecord) -> None:
        """Resolve User/Project/WorkType mappings for a record."""
        # Resolve user
        if record.person_id:
            user_result = self.user_resolver.resolve(
                person_id=record.person_id,
                hints={"english_name": record.title},  # Use title as hint
            )
            record.user_uuid = user_result.mapped_id
            record.user_confidence = user_result.confidence

            if user_result.status == ResolutionStatus.UNRESOLVED:
                record.error = user_result.reason
                self.report.unresolved_users.append({
                    "person_id": record.person_id,
                    "reason": user_result.reason,
                    "alternatives": user_result.alternatives[:3],
                })
            elif user_result.status == ResolutionStatus.LOW_CONFIDENCE:
                record.needs_review = True

        # Resolve project
        if record.project_id:
            project_result = self.project_resolver.resolve(
                project_id=record.project_id,
                description=record.title,
            )
            record.project_uuid = project_result.mapped_id
            record.project_confidence = project_result.confidence

            if project_result.status == ResolutionStatus.UNRESOLVED:
                record.error = project_result.reason
                self.report.unresolved_projects.append({
                    "project_id": record.project_id,
                    "title": record.title,
                    "reason": project_result.reason,
                    "alternatives": project_result.alternatives[:3],
                })
            elif project_result.status == ResolutionStatus.LOW_CONFIDENCE:
                record.needs_review = True

        # Resolve work type
        if record.worktype_id:
            worktype_result = self.worktype_resolver.resolve(
                worktype_id=record.worktype_id,
                description=record.title,
            )
            record.worktype_uuid = worktype_result.mapped_id
            record.worktype_confidence = worktype_result.confidence

    def execute(
        self,
        days: int = -7,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        dry_run: bool = True,
    ) -> MigrationReport:
        """
        Execute migration (or dry-run).

        Args:
            days: Number of days to look back
            start_date: Optional explicit start date
            end_date: Optional explicit end date
            dry_run: If True, don't actually insert (default)

        Returns:
            MigrationReport with execution results
        """
        # Analyze first if not already done
        if not self.report or self.report.status != MigrationStatus.RESOLVED:
            self.analyze(days=days, start_date=start_date, end_date=end_date)

        self.report.status = MigrationStatus.EXECUTING

        # Process records
        for record in self.worklogs:
            # Skip duplicates
            if record.is_duplicate:
                self.report.skipped_records += 1
                continue

            # Skip unresolved
            if record.error or not record.user_uuid or not record.project_uuid:
                self.report.skipped_records += 1
                continue

            if dry_run:
                # Just count as would-be inserted
                self.report.inserted_records += 1
            else:
                # Actually insert to DB
                try:
                    self._insert_worklog(record)
                    self.report.inserted_records += 1
                except Exception as e:
                    self.report.errors.append(f"Insert failed for {record.csv_id}: {str(e)}")
                    self.report.skipped_records += 1

        self.report.status = MigrationStatus.COMPLETED
        return self.report

    def _insert_worklog(self, record: WorklogRecord) -> None:
        """Insert a worklog record to database."""
        if not self.db:
            raise ValueError("Database session not set")

        # Import here to avoid circular imports
        from app.models.resource import WorkLog

        worklog = WorkLog(
            user_id=record.user_uuid,
            project_id=record.project_uuid,
            work_type_category_id=record.worktype_uuid,
            date=record.date.date(),
            hours=record.hours,
            description=record.title,
            is_sudden_work=record.is_sudden,
            is_business_trip=record.is_business_trip,
        )

        self.db.add(worklog)
        self.db.commit()

    def generate_csv_report(self, output_path: str) -> str:
        """Generate CSV report of migration results."""
        if not self.report:
            raise ValueError("No report available. Run analyze() first.")

        filepath = Path(output_path)
        filepath.parent.mkdir(parents=True, exist_ok=True)

        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)

            # Header
            writer.writerow([
                "csv_id", "date", "hours", "title",
                "person_id", "user_uuid", "user_confidence",
                "project_id", "project_uuid", "project_confidence",
                "is_duplicate", "needs_review", "error",
            ])

            # Data
            for record in self.worklogs:
                writer.writerow([
                    record.csv_id,
                    record.date.strftime("%Y-%m-%d"),
                    record.hours,
                    record.title[:100],
                    record.person_id,
                    record.user_uuid or "",
                    f"{record.user_confidence:.2f}",
                    record.project_id,
                    record.project_uuid or "",
                    f"{record.project_confidence:.2f}",
                    record.is_duplicate,
                    record.needs_review,
                    record.error or "",
                ])

        return str(filepath)

    def generate_summary(self) -> str:
        """Generate human-readable summary."""
        if not self.report:
            return "No report available. Run analyze() first."

        lines = [
            "=" * 60,
            "CSV Worklog Migration Report",
            "=" * 60,
            f"Timestamp: {self.report.timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
            f"Date Range: {self.report.date_range[0].strftime('%Y-%m-%d')} ~ {self.report.date_range[1].strftime('%Y-%m-%d')}",
            "",
            "--- Record Counts ---",
            f"Total in CSV: {self.report.total_records:,}",
            f"Filtered (in date range): {self.report.filtered_records:,}",
            f"Duplicates (already in DB): {self.report.duplicate_records:,}",
            f"Resolved (ready to insert): {self.report.resolved_records:,}",
            f"Low Confidence (needs review): {self.report.low_confidence_records:,}",
            f"Unresolved (will skip): {self.report.unresolved_records:,}",
            "",
            "--- User Resolution ---",
        ]

        for key, value in self.report.user_stats.items():
            lines.append(f"  {key}: {value}")

        lines.extend([
            "",
            "--- Project Resolution ---",
        ])

        for key, value in self.report.project_stats.items():
            lines.append(f"  {key}: {value}")

        if self.report.unresolved_users:
            lines.extend([
                "",
                "--- Unresolved Users (top 10) ---",
            ])
            for item in self.report.unresolved_users[:10]:
                lines.append(f"  Person.id={item['person_id']}: {item['reason']}")

        if self.report.unresolved_projects:
            lines.extend([
                "",
                "--- Unresolved Projects (top 10) ---",
            ])
            for item in self.report.unresolved_projects[:10]:
                lines.append(f"  Project.id={item['project_id']}: {item['title'][:50]}")

        if self.report.status == MigrationStatus.COMPLETED:
            lines.extend([
                "",
                "--- Execution Result ---",
                f"Inserted: {self.report.inserted_records:,}",
                f"Skipped: {self.report.skipped_records:,}",
            ])

        lines.append("=" * 60)

        return "\n".join(lines)
