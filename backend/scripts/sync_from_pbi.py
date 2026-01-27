"""
Sync from Power BI Desktop (or CSV) to PostgreSQL

Main synchronization script that:
1. Connects to Power BI Desktop (must be running with .pbix loaded)
   - Or falls back to CSV mode on macOS/Linux
2. Executes DAX queries to extract data from Power BI tables
3. Transforms data to PostgreSQL format
4. INSERT ONLY - 기존 데이터 절대 삭제/수정 안함, 새 데이터만 추가

Usage:
    cd backend
    # Power BI mode (Windows)
    python -m scripts.sync_from_pbi --test              # Test Power BI connection
    python -m scripts.sync_from_pbi --worklogs -0       # 오늘 워크로그만 동기화

    # CSV mode (macOS/Linux or --csv flag)
    python -m scripts.sync_from_pbi --csv --worklogs -0       # CSV에서 오늘 워크로그
    python -m scripts.sync_from_pbi --csv --worklogs -7d      # CSV에서 최근 7일
    python -m scripts.sync_from_pbi --csv --worklogs --from 2025-01-20 --to 2025-01-27

Requirements:
    - Power BI Desktop running with .pbix file loaded (Windows)
    - Or CSV files in ref_table/ directory (macOS/Linux)
    - PostgreSQL database accessible

CSV Files (in ref_table/):
    - db_users.csv: Person.id → email 매핑
    - db_projects.csv: Project ID → IO code 매핑
    - db_worktype.csv: Worktype ID → Title 매핑
    - tb_worklog.csv: 워크로그 데이터

IMPORTANT:
    - 데이터 삭제 없음 (DROP/DELETE 금지)
    - INSERT ONLY - 새 레코드만 추가
    - 기존 레코드는 절대 수정하지 않음
"""

import sys
import argparse
import platform
import re
import csv
from pathlib import Path
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from sqlalchemy import text, and_

from app.core.database import Base, get_engine, get_session_local
from app.core.security import get_password_hash
from app.models.user import User
from app.models.organization import BusinessUnit, Department, SubTeam, JobPosition
from app.models.project import Project, ProjectType, Program, ProductLine
from app.models.resource import WorkLog
from app.models.work_type import WorkTypeCategory, WorkTypeLegacyMapping

from app.services.data_transformer import DataTransformer, TransformResult

# Check if running on Windows (required for Power BI connector)
IS_WINDOWS = platform.system() == "Windows"

# Configuration
DEFAULT_PASSWORD = "password123"
BATCH_SIZE = 1000
REF_TABLE_PATH = Path(__file__).parent.parent.parent / "ref_table"


def parse_date_range(days_arg: str) -> Tuple[date, date]:
    """
    Parse date range from argument like '-0', '-1d', '-7d'.

    Args:
        days_arg: '-0' (today), '-1d' (yesterday), '-7d' (last 7 days)

    Returns:
        Tuple of (start_date, end_date)
    """
    today = date.today()

    if days_arg == "-0" or days_arg == "0":
        # 오늘만
        return (today, today)

    # Parse -Nd format
    match = re.match(r"-?(\d+)d?", days_arg)
    if match:
        days = int(match.group(1))
        if days == 0:
            return (today, today)
        # 최근 N일
        start_date = today - timedelta(days=days - 1)
        return (start_date, today)

    raise ValueError(f"Invalid date range format: {days_arg}. Use -0, -1d, -7d, etc.")


class SyncStats:
    """Track synchronization statistics."""

    def __init__(self):
        self.processed = 0
        self.created = 0
        self.skipped_existing = 0  # 이미 존재해서 스킵
        self.skipped_invalid = 0   # 데이터 오류로 스킵
        self.errors = 0
        self.error_messages: List[str] = []

    def __str__(self):
        return (
            f"Processed: {self.processed}, Created: {self.created}, "
            f"Skipped(existing): {self.skipped_existing}, "
            f"Skipped(invalid): {self.skipped_invalid}, Errors: {self.errors}"
        )


class PowerBISynchronizer:
    """
    Synchronizes data from Power BI Desktop (or CSV) to PostgreSQL.

    IMPORTANT: INSERT ONLY mode - 기존 데이터 절대 수정/삭제 안함
    """

    def __init__(self, dry_run: bool = False, verbose: bool = False, csv_mode: bool = False):
        self.dry_run = dry_run
        self.verbose = verbose
        self.csv_mode = csv_mode
        self.connector = None
        self.transformer = DataTransformer()
        self.db: Optional[Session] = None

        # Pre-computed lookup maps from database
        self.program_map: Dict[str, str] = {}
        self.work_type_category_map: Dict[str, int] = {}

        # Existing data cache for duplicate detection
        self.existing_user_emails: set = set()
        self.existing_project_codes: set = set()
        self.existing_worklog_keys: set = set()  # (user_id, project_id, date, hours)

        # CSV mode: ID mappings from reference files → DB UUIDs
        self.person_id_to_email: Dict[str, str] = {}    # CSV Person.id → email
        self.email_to_uuid: Dict[str, str] = {}          # email → DB user UUID
        self.csv_project_id_to_code: Dict[str, str] = {} # CSV Project.Id → IO code
        self.project_code_to_uuid: Dict[str, str] = {}   # IO code → DB project UUID
        self.worktype_id_to_name: Dict[str, str] = {}    # CSV Worktype.Id → Title

        # Project keyword matching (for worklogs without direct project mapping)
        self.project_keywords: Dict[str, str] = {}       # keyword → project UUID
        self.default_project_id: Optional[str] = None    # General/Non-Project

    def connect_pbi(self) -> bool:
        """Connect to Power BI Desktop."""
        if self.csv_mode:
            print("CSV mode enabled - skipping Power BI connection")
            return False

        if not IS_WINDOWS:
            print("Warning: Power BI connector requires Windows.")
            print("Using CSV fallback mode...")
            self.csv_mode = True
            return False

        try:
            from scripts.pbi_connector import PowerBIConnector

            self.connector = PowerBIConnector()
            if self.connector.connect():
                print(f"Connected to Power BI Desktop on port {self.connector.port}")
                return True
            return False
        except ImportError as e:
            print(f"Power BI connector not available: {e}")
            self.csv_mode = True
            return False

    def read_csv(self, filename: str) -> List[Dict[str, Any]]:
        """Read CSV file from ref_table directory."""
        filepath = REF_TABLE_PATH / filename
        if not filepath.exists():
            print(f"Warning: CSV file not found: {filepath}")
            return []

        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                return list(reader)
        except UnicodeDecodeError:
            # Try UTF-16 encoding
            try:
                with open(filepath, "r", encoding="utf-16") as f:
                    reader = csv.DictReader(f)
                    return list(reader)
            except Exception as e:
                print(f"Error reading CSV {filename}: {e}")
                return []

    def build_id_mappings_from_db(self):
        """
        Build ID mappings from DB for CSV mode.

        Maps CSV IDs to DB UUIDs via email/code lookup.
        """
        if self.db is None:
            return

        print("\nBuilding ID mappings from database...")

        # 1. Load users from DB: email → UUID
        users = self.db.query(User.id, User.email).filter(User.is_active == True).all()
        self.email_to_uuid = {u.email.lower(): u.id for u in users}
        print(f"  DB users loaded: {len(self.email_to_uuid)}")

        # 2. Load projects from DB: code → UUID, and build keyword map
        projects = self.db.query(Project.id, Project.code, Project.name).all()
        for p in projects:
            self.project_code_to_uuid[p.code] = p.id

            # Build keyword map for text matching
            name_lower = (p.name or "").lower()
            keywords = name_lower.replace("_", " ").replace("-", " ").split()
            for keyword in keywords:
                if len(keyword) > 3 and keyword not in ["phase", "project", "for", "the", "and"]:
                    self.project_keywords[keyword] = p.id

            # Find default project (General/Non-Project)
            if "general" in name_lower and "non-project" in name_lower:
                self.default_project_id = p.id

        print(f"  DB projects loaded: {len(self.project_code_to_uuid)}")
        print(f"  Project keywords: {len(self.project_keywords)}")
        if self.default_project_id:
            print(f"  Default project: {self.default_project_id}")

    def build_csv_id_mappings(self):
        """
        Build CSV ID mappings from reference files.

        Maps CSV Person.id → email, Project.Id → code, etc.
        """
        print("\nLoading CSV reference files...")

        # 1. Load db_users.csv: Person.id → email
        users_data = self.read_csv("db_users.csv")
        for row in users_data:
            person_id = row.get("Person.id", "").strip()
            email = row.get("Person.email", "") or row.get("email", "")
            if person_id and email:
                # Normalize person_id (handle "12345.0" format)
                try:
                    person_id = str(int(float(person_id)))
                except:
                    pass
                self.person_id_to_email[person_id] = email.lower().strip()

        print(f"  CSV Person.id → email: {len(self.person_id_to_email)} mappings")

        # 2. Load db_projects.csv: Project ID → IO code
        projects_data = self.read_csv("db_projects.csv")
        for row in projects_data:
            csv_id = row.get("ID", "").strip()
            io_code = row.get("IO", "").strip()
            if csv_id and io_code:
                self.csv_project_id_to_code[csv_id] = io_code

        print(f"  CSV Project.Id → code: {len(self.csv_project_id_to_code)} mappings")

        # 3. Load db_worktype.csv: Worktype.Id → Title
        worktype_data = self.read_csv("db_worktype.csv")
        for row in worktype_data:
            wt_id = row.get("Id", "").strip()
            title = row.get("Title", "").strip()
            if wt_id and title:
                self.worktype_id_to_name[wt_id] = title

        print(f"  CSV Worktype.Id → title: {len(self.worktype_id_to_name)} mappings")

        # 4. Build final mapping: CSV Person.id → DB UUID
        mapped_users = 0
        for person_id, email in self.person_id_to_email.items():
            if email in self.email_to_uuid:
                self.transformer.lookup.user_id_map[person_id] = self.email_to_uuid[email]
                mapped_users += 1

        print(f"  Person.id → UUID: {mapped_users}/{len(self.person_id_to_email)} mapped")

        # 5. Build final mapping: CSV Project.Id → DB UUID
        mapped_projects = 0
        for csv_id, code in self.csv_project_id_to_code.items():
            if code in self.project_code_to_uuid:
                self.transformer.lookup.project_id_map[csv_id] = self.project_code_to_uuid[code]
                mapped_projects += 1

        print(f"  Project.Id → UUID: {mapped_projects}/{len(self.csv_project_id_to_code)} mapped")

    def get_user_uuid(self, person_id: str) -> Optional[str]:
        """Get DB user UUID from CSV Person.id."""
        if not person_id:
            return None
        try:
            person_id = str(int(float(str(person_id).strip())))
        except:
            return None

        return self.transformer.lookup.user_id_map.get(person_id)

    def get_project_uuid(self, project_id: str, description: str = "") -> Optional[str]:
        """
        Get DB project UUID from CSV Project.Id.

        Falls back to keyword matching if direct mapping not found.
        """
        # 1. Direct mapping
        if project_id:
            try:
                project_id = str(int(float(str(project_id).strip())))
            except:
                pass
            uuid = self.transformer.lookup.project_id_map.get(project_id)
            if uuid:
                return uuid

        # 2. Keyword matching from description
        if description:
            desc_lower = description.lower()

            # Priority keywords (specific project names)
            priority_keywords = [
                'vizeon', 'tumalo', 'protron', 'savas', 'unify', 'hermes',
                'havasu', 'zenith', 'areca', 'lpln', 'micron', 'taylor'
            ]

            for keyword in priority_keywords:
                if keyword in desc_lower and keyword in self.project_keywords:
                    return self.project_keywords[keyword]

            # All keywords (longer first)
            for keyword in sorted(self.project_keywords.keys(), key=len, reverse=True):
                if len(keyword) > 4 and keyword in desc_lower:
                    return self.project_keywords[keyword]

        # 3. Default project
        return self.default_project_id

    def connect_db(self) -> bool:
        """Connect to PostgreSQL database."""
        try:
            SessionLocal = get_session_local()
            self.db = SessionLocal()
            print("Connected to PostgreSQL database")
            return True
        except Exception as e:
            print(f"Database connection error: {e}")
            return False

    def close(self):
        """Close all connections."""
        if self.connector:
            self.connector.close()
        if self.db:
            self.db.close()

    def load_lookup_tables(self):
        """Load lookup tables from database for ID mapping."""
        if self.db is None:
            return

        # Load program map
        programs = self.db.query(Program).all()
        self.program_map = {p.name: p.id for p in programs}
        self.program_map[""] = "PRG_UNKNOWN"
        self.program_map[None] = "PRG_UNKNOWN"
        self.transformer.set_program_map(self.program_map)

        # Load work type legacy mapping
        mappings = self.db.query(WorkTypeLegacyMapping).all()
        self.work_type_category_map = {m.legacy_work_type: m.category_id for m in mappings}

        # Also map by category name for fallback
        categories = self.db.query(WorkTypeCategory).filter(WorkTypeCategory.level == 3).all()
        for cat in categories:
            if cat.name not in self.work_type_category_map:
                self.work_type_category_map[cat.name] = cat.id

        self.transformer.set_work_type_category_map(self.work_type_category_map)

        print(f"Loaded {len(self.program_map)} programs, {len(self.work_type_category_map)} work type mappings")

    def load_existing_data(self, date_range: Optional[Tuple[date, date]] = None):
        """
        Load existing data keys for duplicate detection.

        Args:
            date_range: Optional date range for worklog filtering
        """
        if self.db is None:
            return

        print("\nLoading existing data for duplicate detection...")

        # Load existing user emails
        users = self.db.query(User.email).all()
        self.existing_user_emails = {u.email.lower() for u in users}
        print(f"  Existing users: {len(self.existing_user_emails)}")

        # Load existing project codes
        projects = self.db.query(Project.code).all()
        self.existing_project_codes = {p.code for p in projects}
        print(f"  Existing projects: {len(self.existing_project_codes)}")

        # Load existing worklog keys (within date range if specified)
        query = self.db.query(WorkLog.user_id, WorkLog.project_id, WorkLog.date, WorkLog.hours)

        if date_range:
            start_date, end_date = date_range
            query = query.filter(and_(
                WorkLog.date >= start_date,
                WorkLog.date <= end_date
            ))
            print(f"  Checking worklogs from {start_date} to {end_date}")

        worklogs = query.all()
        self.existing_worklog_keys = {
            (w.user_id, w.project_id, w.date, float(w.hours))
            for w in worklogs
        }
        print(f"  Existing worklogs in range: {len(self.existing_worklog_keys)}")

    def execute_dax(self, query: str) -> Optional[List[Dict[str, Any]]]:
        """
        Execute a DAX query and return results as list of dictionaries.

        Falls back to CSV if Power BI connector is not available.
        """
        if self.connector:
            df = self.connector.execute_dax(query)
            if df is not None:
                return df.to_dict("records")
        return None

    def sync_users(self) -> SyncStats:
        """
        Synchronize users from Power BI to PostgreSQL.

        INSERT ONLY - 이미 존재하는 사용자는 건드리지 않음
        """
        print("\n" + "=" * 60)
        print("Syncing Users (INSERT ONLY - 새 사용자만 추가)")
        print("=" * 60)

        stats = SyncStats()
        hashed_password = get_password_hash(DEFAULT_PASSWORD)

        # Get data from Power BI
        dax_query = "EVALUATE db_users"
        rows = self.execute_dax(dax_query)

        if rows is None:
            print("Error: Could not retrieve users from Power BI")
            stats.errors = 1
            return stats

        print(f"Retrieved {len(rows)} users from Power BI")

        for row in rows:
            stats.processed += 1

            # Transform row
            result = self.transformer.transform_user(row, hashed_password)

            if not result.success:
                if self.verbose:
                    print(f"  Skip(invalid): {result.error}")
                stats.skipped_invalid += 1
                continue

            email = result.data["email"].lower()

            # Check if already exists - SKIP if exists
            if email in self.existing_user_emails:
                stats.skipped_existing += 1
                # Still need to populate ID map for worklog sync
                existing_user = self.db.query(User).filter(User.email == email).first()
                if existing_user:
                    source_id = row.get("Person.id")
                    if source_id:
                        self.transformer.lookup.user_id_map[source_id] = existing_user.id
                continue

            # Print warnings
            for warning in result.warnings:
                if self.verbose:
                    print(f"  Warning: {warning}")

            if self.dry_run:
                stats.created += 1
                continue

            # INSERT new user
            try:
                user = User(**result.data)
                self.db.add(user)
                self.existing_user_emails.add(email)
                stats.created += 1

                # Commit every BATCH_SIZE records
                if stats.created % BATCH_SIZE == 0:
                    self.db.commit()
                    print(f"  Created {stats.created} new users...")

            except Exception as e:
                stats.errors += 1
                stats.error_messages.append(f"User {email}: {str(e)}")
                if self.verbose:
                    print(f"  Error: {e}")

        # Final commit
        if not self.dry_run:
            self.db.commit()

        print(f"Users: {stats}")
        return stats

    def sync_projects(self) -> SyncStats:
        """
        Synchronize projects from Power BI to PostgreSQL.

        INSERT ONLY - 이미 존재하는 프로젝트는 건드리지 않음
        """
        print("\n" + "=" * 60)
        print("Syncing Projects (INSERT ONLY - 새 프로젝트만 추가)")
        print("=" * 60)

        stats = SyncStats()

        # Get data from Power BI
        dax_query = "EVALUATE db_projects"
        rows = self.execute_dax(dax_query)

        if rows is None:
            print("Error: Could not retrieve projects from Power BI")
            stats.errors = 1
            return stats

        print(f"Retrieved {len(rows)} projects from Power BI")

        for row in rows:
            stats.processed += 1

            # Transform row
            result = self.transformer.transform_project(row)

            if not result.success:
                if self.verbose:
                    print(f"  Skip(invalid): {result.error}")
                stats.skipped_invalid += 1
                continue

            code = result.data["code"]

            # Check if already exists - SKIP if exists
            if code in self.existing_project_codes:
                stats.skipped_existing += 1
                # Still need to populate ID map for worklog sync
                existing_proj = self.db.query(Project).filter(Project.code == code).first()
                if existing_proj:
                    source_id = row.get("ID")
                    if source_id:
                        self.transformer.lookup.project_id_map[source_id] = existing_proj.id
                continue

            # Print warnings
            for warning in result.warnings:
                if self.verbose:
                    print(f"  Warning: {warning}")

            if self.dry_run:
                stats.created += 1
                continue

            # INSERT new project
            try:
                project = Project(**result.data)
                self.db.add(project)
                self.existing_project_codes.add(code)
                stats.created += 1

                # Commit every BATCH_SIZE records
                if stats.created % BATCH_SIZE == 0:
                    self.db.commit()
                    print(f"  Created {stats.created} new projects...")

            except Exception as e:
                stats.errors += 1
                stats.error_messages.append(f"Project {code}: {str(e)}")
                if self.verbose:
                    print(f"  Error: {e}")

        # Final commit
        if not self.dry_run:
            self.db.commit()

        print(f"Projects: {stats}")
        return stats

    def sync_worktypes(self) -> SyncStats:
        """
        Load work types from Power BI into transformer lookup.

        Work types are mapped to work_type_categories via legacy mapping.
        This just populates the transformer's worktype_map.
        """
        print("\n" + "=" * 60)
        print("Loading Work Types")
        print("=" * 60)

        stats = SyncStats()

        # Get data from Power BI
        dax_query = "EVALUATE db_worktype"
        rows = self.execute_dax(dax_query)

        if rows is None:
            print("Error: Could not retrieve work types from Power BI")
            stats.errors = 1
            return stats

        print(f"Retrieved {len(rows)} work types from Power BI")

        for row in rows:
            stats.processed += 1
            result = self.transformer.transform_worktype(row)
            if result.success:
                stats.created += 1

        print(f"Work Types loaded: {stats.created}")
        return stats

    def sync_worklogs(
        self,
        date_range: Optional[Tuple[date, date]] = None
    ) -> SyncStats:
        """
        Synchronize worklogs from Power BI (or CSV) to PostgreSQL.

        INSERT ONLY - 이미 존재하는 워크로그는 건드리지 않음

        Args:
            date_range: Optional (start_date, end_date) to filter worklogs
        """
        print("\n" + "=" * 60)
        print("Syncing WorkLogs (INSERT ONLY - 새 워크로그만 추가)")
        print("=" * 60)

        if date_range:
            start_date, end_date = date_range
            print(f"Date range: {start_date} ~ {end_date}")
        else:
            print("Date range: ALL (전체)")

        print("This may take several minutes for large datasets...")

        stats = SyncStats()

        # Get data from Power BI or CSV
        if self.csv_mode:
            rows = self._load_worklogs_from_csv(date_range)
        else:
            rows = self._load_worklogs_from_pbi(date_range)

        if rows is None:
            print("Error: Could not retrieve worklogs")
            stats.errors = 1
            return stats

        print(f"Retrieved {len(rows)} worklogs")

        # Get default work type category
        default_category = self.db.query(WorkTypeCategory).filter(
            WorkTypeCategory.level == 3
        ).first()

        batch = []
        project_match_stats = {"matched": 0, "keyword": 0, "default": 0, "none": 0}

        for row in rows:
            stats.processed += 1

            # Process worklog based on mode
            if self.csv_mode:
                worklog_data = self._process_csv_worklog(row, default_category, project_match_stats)
            else:
                worklog_data = self._process_pbi_worklog(row, default_category)

            if worklog_data is None:
                stats.skipped_invalid += 1
                continue

            # Check if already exists - SKIP if exists
            worklog_key = (
                worklog_data["user_id"],
                worklog_data.get("project_id"),
                worklog_data["date"],
                float(worklog_data["hours"])
            )

            if worklog_key in self.existing_worklog_keys:
                stats.skipped_existing += 1
                continue

            if self.dry_run:
                stats.created += 1
                continue

            # INSERT new worklog
            try:
                worklog = WorkLog(**worklog_data)
                batch.append(worklog)
                self.existing_worklog_keys.add(worklog_key)
                stats.created += 1

                # Commit in batches
                if len(batch) >= BATCH_SIZE:
                    self.db.add_all(batch)
                    self.db.commit()
                    batch = []
                    print(f"  Created {stats.created} new worklogs (processed {stats.processed})...")

            except Exception as e:
                stats.errors += 1
                if self.verbose:
                    print(f"  Error: {e}")

        # Final batch
        if batch and not self.dry_run:
            self.db.add_all(batch)
            self.db.commit()

        # Print project matching stats for CSV mode
        if self.csv_mode:
            print(f"\nProject matching stats:")
            print(f"  Direct match: {project_match_stats['matched']}")
            print(f"  Keyword match: {project_match_stats['keyword']}")
            print(f"  Default project: {project_match_stats['default']}")
            print(f"  No project: {project_match_stats['none']}")

        print(f"WorkLogs: {stats}")
        return stats

    def _load_worklogs_from_pbi(self, date_range: Optional[Tuple[date, date]]) -> Optional[List[Dict]]:
        """Load worklogs from Power BI Desktop."""
        if date_range:
            start_date, end_date = date_range
            dax_query = f"""
            EVALUATE
            FILTER(
                tb_worklog,
                tb_worklog[Date] >= DATE({start_date.year}, {start_date.month}, {start_date.day}) &&
                tb_worklog[Date] <= DATE({end_date.year}, {end_date.month}, {end_date.day})
            )
            """
        else:
            dax_query = "EVALUATE tb_worklog"

        return self.execute_dax(dax_query)

    def _load_worklogs_from_csv(self, date_range: Optional[Tuple[date, date]]) -> Optional[List[Dict]]:
        """Load worklogs from CSV file with optional date filtering."""
        # Try different CSV filenames
        csv_files = [
            "tb_worklog.csv",
            "tb_worklog_filtered_2026.1.13.csv",
            "tb_worklog copy.csv"
        ]

        rows = None
        for filename in csv_files:
            rows = self.read_csv(filename)
            if rows:
                print(f"  Loaded from: {filename}")
                break

        if not rows:
            print("Error: No worklog CSV file found")
            return None

        # Filter by date range if specified
        if date_range:
            start_date, end_date = date_range
            filtered_rows = []

            for row in rows:
                date_str = row.get("Date", "").strip()
                row_date = self._parse_date(date_str)

                if row_date and start_date <= row_date <= end_date:
                    filtered_rows.append(row)

            print(f"  Filtered: {len(filtered_rows)}/{len(rows)} rows in date range")
            return filtered_rows

        return rows

    def _parse_date(self, date_str: str) -> Optional[date]:
        """Parse date from various formats."""
        if not date_str:
            return None

        formats = [
            "%Y-%m-%d",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%A, %B %d, %Y",  # Monday, January 13, 2025
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str.split(" ")[0] if " " in date_str and fmt == "%Y-%m-%d" else date_str, fmt).date()
            except ValueError:
                continue

        # Try extracting just the date part
        try:
            return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        except:
            return None

    def _process_csv_worklog(
        self,
        row: Dict[str, Any],
        default_category: Optional[WorkTypeCategory],
        project_stats: Dict[str, int]
    ) -> Optional[Dict[str, Any]]:
        """Process a single worklog row from CSV."""

        # Get user UUID from Person.id
        created_by_id = row.get("Createdby.Id", "")
        user_id = self.get_user_uuid(created_by_id)

        if not user_id:
            if self.verbose:
                print(f"  Skip: Unknown user Person.id={created_by_id}")
            return None

        # Parse date
        date_str = row.get("Date", "").strip()
        worklog_date = self._parse_date(date_str)

        if not worklog_date:
            if self.verbose:
                print(f"  Skip: Invalid date {date_str}")
            return None

        # Parse hours
        try:
            hours = float(row.get("Hours", 1.0) or 1.0)
        except:
            hours = 1.0

        # Get project UUID
        project_id_raw = row.get("Project.Id", "")
        description = row.get("Title", "").strip()
        is_project = row.get("IsProject?", "").strip()

        project_id = None
        if is_project == "Project":
            # Try direct mapping first
            project_id = self.get_project_uuid(project_id_raw, "")
            if project_id:
                project_stats["matched"] += 1
            else:
                # Try keyword matching
                project_id = self.get_project_uuid("", description)
                if project_id and project_id != self.default_project_id:
                    project_stats["keyword"] += 1
                elif project_id == self.default_project_id:
                    project_stats["default"] += 1
                else:
                    project_id = self.default_project_id
                    project_stats["default"] += 1
        else:
            # Non-project work
            project_stats["none"] += 1

        # Get work type category
        worktype_id_raw = row.get("Worktype.Id", "").strip()
        worktype_name = self.worktype_id_to_name.get(worktype_id_raw, "Other")
        work_type_category_id = self.work_type_category_map.get(worktype_name)

        if not work_type_category_id and default_category:
            work_type_category_id = default_category.id

        if not work_type_category_id:
            if self.verbose:
                print(f"  Skip: No work type category for {worktype_name}")
            return None

        # Parse boolean fields
        def parse_bool(val):
            return str(val).strip().upper() == "TRUE" if val else False

        return {
            "date": worklog_date,
            "user_id": user_id,
            "project_id": project_id,
            "work_type_category_id": work_type_category_id,
            "hours": hours,
            "description": description,
            "is_sudden_work": parse_bool(row.get("SuddenWork?")),
            "is_business_trip": parse_bool(row.get("BusinessTrip")),
        }

    def _process_pbi_worklog(
        self,
        row: Dict[str, Any],
        default_category: Optional[WorkTypeCategory]
    ) -> Optional[Dict[str, Any]]:
        """Process a single worklog row from Power BI."""
        result = self.transformer.transform_worklog(row)

        if not result.success:
            return None

        data = result.data.copy()

        # Handle work type category
        if data.get("work_type_category_id") is None:
            if default_category:
                data["work_type_category_id"] = default_category.id
            else:
                return None

        data.pop("_work_type_name", None)
        return data

    def sync_all(self, date_range: Optional[Tuple[date, date]] = None) -> Dict[str, SyncStats]:
        """
        Perform full synchronization of all entities.

        INSERT ONLY - 기존 데이터 절대 수정/삭제 안함

        Order:
        1. Work Types (loads into lookup, no DB writes)
        2. Users (INSERT new users only)
        3. Projects (INSERT new projects only)
        4. WorkLogs (INSERT new worklogs only, with date filter)
        """
        print("\n" + "=" * 60)
        print("FULL SYNCHRONIZATION (INSERT ONLY)")
        print("=" * 60)
        print(f"Started at: {datetime.now()}")
        print(f"Dry run: {self.dry_run}")
        if date_range:
            print(f"WorkLog date range: {date_range[0]} ~ {date_range[1]}")
        print()
        print("*** 주의: 기존 데이터 삭제/수정 없음 - 새 데이터만 추가 ***")
        print()

        results = {}

        # Load lookup tables from database
        self.load_lookup_tables()

        # Load existing data for duplicate detection
        self.load_existing_data(date_range)

        # Sync in dependency order
        results["worktypes"] = self.sync_worktypes()
        results["users"] = self.sync_users()
        results["projects"] = self.sync_projects()
        results["worklogs"] = self.sync_worklogs(date_range)

        # Print summary
        print("\n" + "=" * 60)
        print("SYNCHRONIZATION COMPLETE")
        print("=" * 60)
        print(f"Completed at: {datetime.now()}")
        print()

        for entity, stats in results.items():
            print(f"{entity.upper()}: {stats}")

        return results


def main():
    parser = argparse.ArgumentParser(
        description="Sync data from Power BI Desktop (or CSV) to PostgreSQL (INSERT ONLY)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Date range examples:
  -0, --today       오늘 데이터만
  -d 1d             어제 데이터
  -d 7d             최근 7일 데이터
  --from 2025-01-20 --to 2025-01-27  특정 기간

Mode:
  (default)         Power BI Desktop (Windows only)
  --csv             CSV files in ref_table/ directory

IMPORTANT:
  - 데이터 삭제 없음 (DROP/DELETE 금지)
  - INSERT ONLY - 새 레코드만 추가
  - 기존 레코드는 절대 수정하지 않음

CSV Files (in ref_table/):
  - db_users.csv: Person.id → email 매핑
  - db_projects.csv: Project ID → IO code 매핑
  - tb_worklog.csv: 워크로그 데이터
        """
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test Power BI connection only"
    )
    parser.add_argument(
        "--csv",
        action="store_true",
        help="Use CSV files instead of Power BI Desktop (macOS/Linux compatible)"
    )
    parser.add_argument(
        "--entity",
        choices=["users", "projects", "worktypes", "worklogs"],
        help="Sync specific entity only"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Full synchronization (INSERT ONLY)"
    )
    parser.add_argument(
        "--worklogs",
        action="store_true",
        help="Sync worklogs only (with date range)"
    )

    # Date range options
    date_group = parser.add_argument_group("Date range options (for worklogs)")
    date_group.add_argument(
        "-0", "--today",
        action="store_true",
        help="오늘 데이터만"
    )
    date_group.add_argument(
        "-d", "--days",
        type=str,
        metavar="Nd",
        help="최근 N일 (예: 1d, 7d, 30d)"
    )
    date_group.add_argument(
        "--from",
        dest="from_date",
        type=str,
        metavar="YYYY-MM-DD",
        help="시작 날짜"
    )
    date_group.add_argument(
        "--to",
        dest="to_date",
        type=str,
        metavar="YYYY-MM-DD",
        help="종료 날짜"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing to database"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )

    args = parser.parse_args()

    # Test mode
    if args.test:
        from scripts.pbi_connector import test_connection
        test_connection()
        return

    # Parse date range
    date_range = None

    if args.today:
        date_range = parse_date_range("-0")
    elif args.days:
        date_range = parse_date_range(args.days)
    elif args.from_date or args.to_date:
        try:
            start = datetime.strptime(args.from_date, "%Y-%m-%d").date() if args.from_date else date.today()
            end = datetime.strptime(args.to_date, "%Y-%m-%d").date() if args.to_date else date.today()
            date_range = (start, end)
        except ValueError as e:
            print(f"Invalid date format: {e}")
            print("Use YYYY-MM-DD format (e.g., 2025-01-20)")
            return

    # Initialize synchronizer
    sync = PowerBISynchronizer(dry_run=args.dry_run, verbose=args.verbose, csv_mode=args.csv)

    # Connect to Power BI (or use CSV mode)
    pbi_connected = sync.connect_pbi()

    if not pbi_connected and not sync.csv_mode:
        print("\nCould not connect to Power BI Desktop.")
        print("Use --csv flag to use CSV files instead.")
        return

    # Connect to database
    if not sync.connect_db():
        print("Could not connect to database. Check DATABASE_URL in .env")
        sync.close()
        return

    try:
        # For CSV mode, build ID mappings from DB and CSV files
        if sync.csv_mode:
            sync.build_id_mappings_from_db()
            sync.build_csv_id_mappings()

        if args.all:
            sync.sync_all(date_range)
        elif args.worklogs:
            if date_range is None:
                print("Warning: No date range specified. This will sync ALL worklogs.")
                print("Use -0 (today), -d 7d (7 days), or --from/--to for date range.")
                response = input("Continue? [y/N]: ")
                if response.lower() != 'y':
                    print("Cancelled.")
                    return

            sync.load_lookup_tables()
            sync.load_existing_data(date_range)

            if not sync.csv_mode:
                # Power BI mode: need to sync users/projects first to build ID maps
                print("\nBuilding ID mappings from existing data...")
                sync.sync_worktypes()
                sync.sync_users()
                sync.sync_projects()

            # Then sync worklogs
            sync.sync_worklogs(date_range)

        elif args.entity:
            sync.load_lookup_tables()
            sync.load_existing_data()

            if args.entity == "users":
                sync.sync_users()
            elif args.entity == "projects":
                sync.sync_projects()
            elif args.entity == "worktypes":
                sync.sync_worktypes()
            elif args.entity == "worklogs":
                print("Note: Syncing worklogs requires existing user/project ID mappings")
                sync.sync_worklogs(date_range)
        else:
            parser.print_help()

    finally:
        sync.close()


if __name__ == "__main__":
    main()
