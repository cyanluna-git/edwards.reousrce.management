"""
Data Transformer Service

Transforms data from CSV format to PostgreSQL schema format.
Modularizes transformation logic for reuse.

CSV Tables → PostgreSQL Tables:
- db_users.csv → users
- db_projects.csv → projects
- db_worktype.csv → work_type_categories (via legacy mapping)
- tb_worklog.csv → worklogs
"""

import uuid
from datetime import datetime, date
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field


def generate_uuid() -> str:
    """Generate a new UUID string."""
    return str(uuid.uuid4())


@dataclass
class TransformResult:
    """Result of a data transformation operation."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    warnings: List[str] = field(default_factory=list)


class FieldMapper:
    """Maps CSV column names to PostgreSQL column names."""

    # CSV → PostgreSQL field mappings for each entity type
    USER_MAPPING = {
        # CSV column → PostgreSQL column
        "Person.id": "source_id",  # Original ID for reference
        "Person.email": "email",
        "email": "email",
        "English Name": "name",
        "Person.EnglishName": "name",
        "KoreanName": "korean_name",
        "Team": "_team",  # Intermediate field for department lookup
        "Department": "_department",  # Intermediate field for sub_team lookup
        "Buniness Area": "_business_area",  # For sub_team determination (typo from source)
        "Business Area": "_business_area",
        "Enable?": "is_active",
    }

    PROJECT_MAPPING = {
        "ID": "source_id",
        "IO": "code",
        "Project": "name",
        "Program": "_program_name",  # For program_id lookup
        "Complexity": "_complexity",  # For project_type_id lookup
        "Status": "status",
        "Customer": "customer",
        "Product": "product",
        "Description": "description",
        "Area": "_area",  # For business unit determination
    }

    WORKTYPE_MAPPING = {
        "Id": "source_id",
        "Title": "name",
    }

    WORKLOG_MAPPING = {
        "ID": "source_id",
        "Createdby.Id": "_user_source_id",  # For user_id lookup
        "Project.Id": "_project_source_id",  # For project_id lookup
        "Worktype.Id": "_worktype_source_id",  # For work_type lookup
        "Date": "date",
        "Hours": "hours",
        "Title": "description",
        "SuddenWork?": "is_sudden_work",
        "BusinessTrip": "is_business_trip",
    }

    @classmethod
    def get_mapping(cls, entity_type: str) -> Dict[str, str]:
        """Get field mapping for an entity type."""
        mappings = {
            "user": cls.USER_MAPPING,
            "project": cls.PROJECT_MAPPING,
            "worktype": cls.WORKTYPE_MAPPING,
            "worklog": cls.WORKLOG_MAPPING,
        }
        return mappings.get(entity_type, {})


class ValueTransformer:
    """Transforms individual field values."""

    @staticmethod
    def clean_string(value: Any) -> Optional[str]:
        """Clean and normalize string value."""
        if value is None:
            return None
        value = str(value).strip()
        return value if value else None

    @staticmethod
    def parse_bool(value: Any) -> bool:
        """Parse boolean from various formats."""
        if value is None:
            return False
        if isinstance(value, bool):
            return value
        return str(value).strip().upper() in ("TRUE", "1", "YES", "Y")

    @staticmethod
    def parse_float(value: Any, default: float = 0.0) -> float:
        """Parse float value."""
        if value is None:
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default

    @staticmethod
    def parse_date(value: Any) -> Optional[date]:
        """Parse date from various formats."""
        if value is None:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()

        date_str = str(value).strip()
        if not date_str:
            return None

        # Try various formats
        formats = [
            "%Y-%m-%d",
            "%Y-%m-%d %H:%M:%S",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y-%m-%dT%H:%M:%S",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str.split(" ")[0].split("T")[0], "%Y-%m-%d").date()
            except ValueError:
                continue

        return None

    @staticmethod
    def map_project_status(csv_status: Optional[str]) -> str:
        """Map CSV status to database status."""
        if csv_status is None:
            return "Prospective"

        status_map = {
            "WIP": "InProgress",
            "Completed": "Completed",
            "Hold": "OnHold",
            "Forecast": "Prospective",
            "Cancelled": "Cancelled",
            "": "Prospective",
        }
        return status_map.get(csv_status.strip(), "Prospective")


class LookupManager:
    """Manages lookup tables for ID mapping."""

    def __init__(self):
        # CSV/Power BI ID → UUID mappings
        self.user_id_map: Dict[str, str] = {}
        self.project_id_map: Dict[str, str] = {}
        self.worktype_map: Dict[str, str] = {}  # worktype ID → title

        # Name → ID mappings
        self.department_map: Dict[str, str] = {}
        self.sub_team_map: Dict[str, str] = {}
        self.program_map: Dict[str, str] = {}
        self.project_type_map: Dict[str, str] = {}
        self.work_type_category_map: Dict[str, int] = {}  # legacy name → category_id

        # Track seen values for deduplication
        self.seen_emails: set = set()
        self.seen_project_codes: set = set()

    def initialize_department_map(self):
        """Initialize standard department mappings."""
        self.department_map = {
            "Control Engineering": "DEPT_CONTROL",
            "NPI, IntegratedSystem": "DEPT_NPI_IS",
            "NPI, Abatement": "DEPT_NPI_ABT",
            "ETO": "DEPT_ETO",
            "ACM Tech": "DEPT_ACM_TECH",
            "Central Engineering": "DEPT_CENTRAL",
            "GECIA": "DEPT_GECIA",
        }

    def initialize_sub_team_map(self):
        """Initialize standard sub-team mappings."""
        self.sub_team_map = {
            ("Software", "IntegratedSystem"): "ST_CTRL_SW_IS",
            ("Software", "Abatement"): "ST_CTRL_SW_ABT",
            ("Electrical", "IntegratedSystem"): "ST_CTRL_ELEC_IS",
            ("Electrical", "Abatement"): "ST_CTRL_ELEC_ABT",
            ("ETO Elec", None): "ST_ETO_ELEC",
            ("Systems", "IntegratedSystem"): "ST_SYS_ENG",
            ("Mechanical", "IntegratedSystem"): "ST_MECH_ENG",
            ("NPI 1 Team", "Abatement"): "ST_NPI1",
            ("DES", None): "ST_DES",
            ("Lab Management", None): "ST_LAB",
            ("Analysis Tech.", None): "ST_ANALYSIS",
            ("RA", None): "ST_RA",
        }

    def initialize_project_type_map(self):
        """Initialize project type mappings."""
        self.project_type_map = {
            "NPI Project": "NPI",
            "ETO Project": "ETO",
            "Support": "SUPPORT",
            "Legacy": "LEGACY",
            "Internal Project": "INTERNAL",
            "Sustaining": "SUSTAINING",
            "Team Task": "TEAM_TASK",
            "A&D": "AND",
            "": "OTHER",
        }

    def get_sub_team_id(self, department: Optional[str], business_area: Optional[str]) -> Optional[str]:
        """Get sub-team ID from department and business area."""
        if not department:
            return None

        # Try exact match with business area
        result = self.sub_team_map.get((department, business_area))
        if result:
            return result

        # Try match without business area
        result = self.sub_team_map.get((department, None))
        return result


class DataTransformer:
    """
    Main data transformer class.

    Transforms rows from Power BI/CSV format to PostgreSQL-ready dictionaries.
    """

    def __init__(self, lookup_manager: Optional[LookupManager] = None):
        self.lookup = lookup_manager or LookupManager()
        self.lookup.initialize_department_map()
        self.lookup.initialize_sub_team_map()
        self.lookup.initialize_project_type_map()

    def transform_user(self, row: Dict[str, Any], hashed_password: str) -> TransformResult:
        """
        Transform a user row from Power BI to PostgreSQL format.

        Args:
            row: Row data from Power BI/CSV
            hashed_password: Pre-hashed default password

        Returns:
            TransformResult with transformed user data
        """
        warnings = []

        # Extract and clean values
        source_id = ValueTransformer.clean_string(row.get("Person.id"))
        email = ValueTransformer.clean_string(row.get("email") or row.get("Person.email"))

        if not email:
            return TransformResult(
                success=False,
                error=f"User missing email: {row.get('KoreanName', 'unknown')}"
            )

        email = email.lower()

        # Check for duplicates
        if email in self.lookup.seen_emails:
            return TransformResult(
                success=False,
                error=f"Duplicate email: {email}"
            )

        self.lookup.seen_emails.add(email)

        # Get names
        name = (
            ValueTransformer.clean_string(row.get("English Name"))
            or ValueTransformer.clean_string(row.get("Person.EnglishName"))
            or ""
        )
        korean_name = ValueTransformer.clean_string(row.get("KoreanName")) or ""

        # Determine department
        team = ValueTransformer.clean_string(row.get("Team", ""))
        department_id = self.lookup.department_map.get(team, "DEPT_CONTROL")

        if team and team not in self.lookup.department_map:
            warnings.append(f"Unknown team '{team}', defaulting to DEPT_CONTROL")

        # Determine sub-team
        dept_col = ValueTransformer.clean_string(row.get("Department", ""))
        business_area = ValueTransformer.clean_string(row.get("Buniness Area") or row.get("Business Area"))
        sub_team_id = self.lookup.get_sub_team_id(dept_col, business_area)

        # Parse active status
        is_active = ValueTransformer.parse_bool(row.get("Enable?"))

        # Generate UUID
        user_uuid = generate_uuid()

        # Store mapping
        if source_id:
            self.lookup.user_id_map[source_id] = user_uuid

        return TransformResult(
            success=True,
            data={
                "id": user_uuid,
                "email": email,
                "hashed_password": hashed_password,
                "name": name,
                "korean_name": korean_name,
                "department_id": department_id,
                "sub_team_id": sub_team_id,
                "position_id": "JP_ENGINEER",  # Default position
                "role": "USER",
                "is_active": is_active,
            },
            warnings=warnings
        )

    def transform_project(self, row: Dict[str, Any]) -> TransformResult:
        """
        Transform a project row from Power BI to PostgreSQL format.

        Args:
            row: Row data from Power BI/CSV

        Returns:
            TransformResult with transformed project data
        """
        warnings = []

        source_id = ValueTransformer.clean_string(row.get("ID"))
        name = ValueTransformer.clean_string(row.get("Project", ""))

        if not name:
            return TransformResult(
                success=False,
                error="Project missing name"
            )

        io_code = ValueTransformer.clean_string(row.get("IO", ""))
        program_name = ValueTransformer.clean_string(row.get("Program", ""))
        complexity = ValueTransformer.clean_string(row.get("Complexity", ""))
        status = ValueTransformer.clean_string(row.get("Status", ""))
        customer = ValueTransformer.clean_string(row.get("Customer", ""))
        product = ValueTransformer.clean_string(row.get("Product", ""))
        description = ValueTransformer.clean_string(row.get("Description", ""))

        # Map program (need to lookup or use default)
        program_id = self.lookup.program_map.get(program_name, "PRG_UNKNOWN")
        if program_name and program_name not in self.lookup.program_map:
            warnings.append(f"Unknown program '{program_name}', using PRG_UNKNOWN")

        # Map project type
        project_type_id = self.lookup.project_type_map.get(complexity, "OTHER")

        # Generate unique code
        base_code = io_code if io_code else f"PRJ-{source_id}"
        code = base_code

        if code in self.lookup.seen_project_codes:
            code = f"{base_code}-{source_id}"
            warnings.append(f"Duplicate code '{base_code}', using '{code}'")

        self.lookup.seen_project_codes.add(code)

        # Generate UUID
        proj_uuid = generate_uuid()

        # Store mapping
        if source_id:
            self.lookup.project_id_map[source_id] = proj_uuid

        return TransformResult(
            success=True,
            data={
                "id": proj_uuid,
                "program_id": program_id,
                "project_type_id": project_type_id,
                "code": code,
                "name": name[:300],  # Truncate if necessary
                "status": ValueTransformer.map_project_status(status),
                "customer": customer,
                "product": product,
                "description": description,
            },
            warnings=warnings
        )

    def transform_worklog(self, row: Dict[str, Any]) -> TransformResult:
        """
        Transform a worklog row from Power BI to PostgreSQL format.

        Args:
            row: Row data from Power BI/CSV

        Returns:
            TransformResult with transformed worklog data
        """
        # Get foreign key references
        csv_user_id = ValueTransformer.clean_string(row.get("Createdby.Id"))
        csv_project_id = ValueTransformer.clean_string(row.get("Project.Id"))
        csv_worktype_id = ValueTransformer.clean_string(row.get("Worktype.Id"))

        # Map to UUIDs
        user_id = self.lookup.user_id_map.get(csv_user_id)
        project_id = self.lookup.project_id_map.get(csv_project_id)

        if not user_id:
            return TransformResult(
                success=False,
                error=f"Unknown user ID: {csv_user_id}"
            )

        if not project_id:
            return TransformResult(
                success=False,
                error=f"Unknown project ID: {csv_project_id}"
            )

        # Parse date
        date_val = ValueTransformer.parse_date(row.get("Date"))
        if not date_val:
            return TransformResult(
                success=False,
                error=f"Invalid date: {row.get('Date')}"
            )

        # Parse hours
        hours = ValueTransformer.parse_float(row.get("Hours", 0))

        # Get work type name from mapping
        work_type_name = self.lookup.worktype_map.get(csv_worktype_id, "Other")

        # Get work type category ID (need lookup from DB)
        work_type_category_id = self.lookup.work_type_category_map.get(work_type_name)

        description = ValueTransformer.clean_string(row.get("Title", ""))
        is_sudden = ValueTransformer.parse_bool(row.get("SuddenWork?"))
        is_trip = ValueTransformer.parse_bool(row.get("BusinessTrip"))

        return TransformResult(
            success=True,
            data={
                "date": date_val,
                "user_id": user_id,
                "project_id": project_id,
                "work_type_category_id": work_type_category_id,
                "_work_type_name": work_type_name,  # For fallback if category lookup needed
                "hours": hours,
                "description": description,
                "is_sudden_work": is_sudden,
                "is_business_trip": is_trip,
            }
        )

    def transform_worktype(self, row: Dict[str, Any]) -> TransformResult:
        """
        Transform a worktype row and store in lookup.

        Args:
            row: Row data from Power BI/CSV

        Returns:
            TransformResult (worktype is just stored in lookup, not inserted)
        """
        wt_id = ValueTransformer.clean_string(row.get("Id"))
        title = ValueTransformer.clean_string(row.get("Title", ""))

        if wt_id and title:
            self.lookup.worktype_map[wt_id] = title

        return TransformResult(
            success=True,
            data={"id": wt_id, "title": title}
        )

    def set_program_map(self, program_map: Dict[str, str]):
        """Set program name → ID mapping."""
        self.lookup.program_map = program_map

    def set_work_type_category_map(self, mapping: Dict[str, int]):
        """Set work type legacy name → category ID mapping."""
        self.lookup.work_type_category_map = mapping

    def get_user_id_map(self) -> Dict[str, str]:
        """Get CSV user ID → UUID mapping."""
        return self.lookup.user_id_map

    def get_project_id_map(self) -> Dict[str, str]:
        """Get CSV project ID → UUID mapping."""
        return self.lookup.project_id_map

    def get_worktype_map(self) -> Dict[str, str]:
        """Get worktype ID → title mapping."""
        return self.lookup.worktype_map
