"""
Service layer for Resource Plan business logic
"""

import json
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.models.resource import ResourcePlan, ResourcePlanHistory
from app.models.project import Project, ProductLine
from app.models.organization import JobPosition, ProjectRole
from app.models.user import User
from app.schemas.resource_plan import ResourcePlanCreate, ResourcePlanUpdate
from app.utils import get_io_number


class ResourcePlanService:
    def __init__(self, db: Session):
        self.db = db

    def _serialize_plan_snapshot(self, plan: ResourcePlan) -> dict:
        """Serialize the meaningful plan state for audit history."""
        return {
            "project_id": plan.project_id,
            "year": plan.year,
            "month": plan.month,
            "position_id": plan.position_id,
            "position_name": plan.position.name if plan.position else None,
            "project_role_id": plan.project_role_id,
            "project_role_name": plan.project_role.name if plan.project_role else None,
            "user_id": plan.user_id,
            "user_name": plan.user.name if plan.user else None,
            "planned_hours": plan.planned_hours,
        }

    def _log_history(
        self,
        *,
        change_type: str,
        actor_user_id: str,
        actor_user_name: str,
        before_snapshot: Optional[dict] = None,
        after_snapshot: Optional[dict] = None,
        resource_plan_id: Optional[int] = None,
    ) -> None:
        """Persist a history entry when a meaningful change occurs."""
        if before_snapshot == after_snapshot:
            return

        source = after_snapshot or before_snapshot
        if not source:
            return

        history = ResourcePlanHistory(
            resource_plan_id=resource_plan_id,
            project_id=source["project_id"],
            year=source["year"],
            month=source["month"],
            position_id=source["position_id"],
            project_role_id=source.get("project_role_id"),
            user_id=source.get("user_id"),
            actor_user_id=actor_user_id,
            actor_user_name=actor_user_name,
            change_type=change_type,
            before_snapshot=json.dumps(before_snapshot) if before_snapshot else None,
            after_snapshot=json.dumps(after_snapshot) if after_snapshot else None,
        )
        self.db.add(history)

    def _build_response(self, plan: ResourcePlan) -> dict:
        """Convert ResourcePlan model to response dict with nested info"""
        # Use already-loaded relationship instead of individual query
        project_role_name = plan.project_role.name if plan.project_role else None

        # Get business_unit_name from project -> product_line -> business_unit chain
        business_unit_name = None
        if plan.project and plan.project.product_line and plan.project.product_line.business_unit:
            business_unit_name = plan.project.product_line.business_unit.name

        return {
            "id": plan.id,
            "project_id": plan.project_id,
            "year": plan.year,
            "month": plan.month,
            "position_id": plan.position_id,
            "project_role_id": plan.project_role_id,
            "user_id": plan.user_id,
            "planned_hours": plan.planned_hours,
            "created_by": plan.created_by,
            "created_at": plan.created_at,
            "updated_at": plan.updated_at,
            "project_name": plan.project.name if plan.project else None,
            "project_code": get_io_number(plan.project) if plan.project else None,
            "position_name": plan.position.name if plan.position else None,
            "project_role_name": project_role_name,
            "user_name": plan.user.name if plan.user else None,
            "business_unit_name": business_unit_name,
            "is_tbd": plan.user_id is None,
        }

    def get_multi(
        self,
        *,
        project_id: Optional[str] = None,
        year: Optional[int] = None,
        month: Optional[int] = None,
        position_id: Optional[str] = None,
        user_id: Optional[str] = None,
        tbd_only: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> List[dict]:
        """Get multiple resource plans with filters"""
        query = self.db.query(ResourcePlan).options(
            joinedload(ResourcePlan.project)
            .joinedload(Project.product_line)
            .joinedload(ProductLine.business_unit),
            joinedload(ResourcePlan.position),
            joinedload(ResourcePlan.user),
            joinedload(ResourcePlan.project_role),
        )

        if project_id:
            query = query.filter(ResourcePlan.project_id == project_id)
        if year:
            query = query.filter(ResourcePlan.year == year)
        if month:
            query = query.filter(ResourcePlan.month == month)
        if position_id:
            query = query.filter(ResourcePlan.position_id == position_id)
        if user_id:
            query = query.filter(ResourcePlan.user_id == user_id)
        if tbd_only:
            query = query.filter(ResourcePlan.user_id.is_(None))

        plans = (
            query.order_by(
                ResourcePlan.year, ResourcePlan.month, ResourcePlan.project_id
            )
            .offset(skip)
            .limit(limit)
            .all()
        )

        return [self._build_response(plan) for plan in plans]

    def get_by_id(self, plan_id: int) -> Optional[dict]:
        """Get a resource plan by ID"""
        plan = (
            self.db.query(ResourcePlan)
            .options(
                joinedload(ResourcePlan.project)
                .joinedload(Project.product_line)
                .joinedload(ProductLine.business_unit),
                joinedload(ResourcePlan.position),
                joinedload(ResourcePlan.user),
                joinedload(ResourcePlan.project_role),
            )
            .filter(ResourcePlan.id == plan_id)
            .first()
        )
        if not plan:
            return None
        return self._build_response(plan)

    def get_history(
        self,
        *,
        project_id: str,
        position_id: str,
        project_role_id: Optional[str],
        user_id: Optional[str],
        is_tbd: bool,
        limit: int = 100,
    ) -> List[dict]:
        """Get audit history for a resource-plan row identity."""
        query = self.db.query(ResourcePlanHistory).filter(
            ResourcePlanHistory.project_id == project_id,
            ResourcePlanHistory.position_id == position_id,
        )

        if project_role_id:
            query = query.filter(ResourcePlanHistory.project_role_id == project_role_id)
        else:
            query = query.filter(ResourcePlanHistory.project_role_id.is_(None))

        if is_tbd:
            query = query.filter(ResourcePlanHistory.user_id.is_(None))
        else:
            query = query.filter(ResourcePlanHistory.user_id == user_id)

        rows = (
            query.order_by(ResourcePlanHistory.created_at.desc(), ResourcePlanHistory.id.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "id": row.id,
                "resource_plan_id": row.resource_plan_id,
                "project_id": row.project_id,
                "year": row.year,
                "month": row.month,
                "position_id": row.position_id,
                "project_role_id": row.project_role_id,
                "user_id": row.user_id,
                "actor_user_id": row.actor_user_id,
                "actor_user_name": row.actor_user_name,
                "change_type": row.change_type,
                "before_values": json.loads(row.before_snapshot)
                if row.before_snapshot
                else None,
                "after_values": json.loads(row.after_snapshot)
                if row.after_snapshot
                else None,
                "created_at": row.created_at,
            }
            for row in rows
        ]

    def create(
        self, plan_in: ResourcePlanCreate, created_by: str, actor_user_name: str
    ) -> dict:
        """Create a new resource plan"""
        # Check if project exists
        project = (
            self.db.query(Project).filter(Project.id == plan_in.project_id).first()
        )
        if not project:
            raise ValueError(f"Project {plan_in.project_id} not found")

        # Check if project_role exists (primary for project resource planning)
        if plan_in.project_role_id:
            project_role = (
                self.db.query(ProjectRole)
                .filter(ProjectRole.id == plan_in.project_role_id)
                .first()
            )
            if not project_role:
                raise ValueError(f"Project Role {plan_in.project_role_id} not found")

        # Check if position exists (legacy/optional)
        if plan_in.position_id:
            position = (
                self.db.query(JobPosition)
                .filter(JobPosition.id == plan_in.position_id)
                .first()
            )
            if not position:
                raise ValueError(f"Position {plan_in.position_id} not found")

        # At least one role must be specified
        if not plan_in.project_role_id and not plan_in.position_id:
            raise ValueError("Either project_role_id or position_id must be provided")

        # Check for duplicates
        duplicate_filter = and_(
            ResourcePlan.project_id == plan_in.project_id,
            ResourcePlan.year == plan_in.year,
            ResourcePlan.month == plan_in.month,
            ResourcePlan.user_id == plan_in.user_id,
        )
        if plan_in.project_role_id:
            duplicate_filter = and_(
                duplicate_filter,
                ResourcePlan.project_role_id == plan_in.project_role_id,
            )
        if plan_in.position_id:
            duplicate_filter = and_(
                duplicate_filter, ResourcePlan.position_id == plan_in.position_id
            )

        existing = self.db.query(ResourcePlan).filter(duplicate_filter).first()
        if existing:
            raise ValueError(
                "Duplicate resource plan exists for this project, period, and role"
            )

        db_plan = ResourcePlan(
            **plan_in.model_dump(),
            created_by=created_by,
        )
        self.db.add(db_plan)
        self.db.commit()
        self.db.refresh(db_plan)
        self._log_history(
            change_type="create",
            actor_user_id=created_by,
            actor_user_name=actor_user_name,
            after_snapshot=self._serialize_plan_snapshot(db_plan),
            resource_plan_id=db_plan.id,
        )
        self.db.commit()

        # Reload with relationships
        return self.get_by_id(db_plan.id)

    def update(
        self,
        plan_id: int,
        plan_in: ResourcePlanUpdate,
        actor_user_id: str,
        actor_user_name: str,
    ) -> Optional[dict]:
        """Update a resource plan"""
        db_plan = self.db.query(ResourcePlan).filter(ResourcePlan.id == plan_id).first()
        if not db_plan:
            return None

        before_snapshot = self._serialize_plan_snapshot(db_plan)
        update_data = plan_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_plan, key, value)

        after_snapshot = self._serialize_plan_snapshot(db_plan)
        if before_snapshot == after_snapshot:
            self.db.refresh(db_plan)
            return self.get_by_id(plan_id)

        self.db.commit()
        self.db.refresh(db_plan)
        self._log_history(
            change_type="update",
            actor_user_id=actor_user_id,
            actor_user_name=actor_user_name,
            before_snapshot=before_snapshot,
            after_snapshot=self._serialize_plan_snapshot(db_plan),
            resource_plan_id=db_plan.id,
        )
        self.db.commit()

        return self.get_by_id(plan_id)

    def delete(self, plan_id: int, actor_user_id: str, actor_user_name: str) -> bool:
        """Delete a resource plan"""
        db_plan = self.db.query(ResourcePlan).filter(ResourcePlan.id == plan_id).first()
        if not db_plan:
            return False

        before_snapshot = self._serialize_plan_snapshot(db_plan)
        self._log_history(
            change_type="delete",
            actor_user_id=actor_user_id,
            actor_user_name=actor_user_name,
            before_snapshot=before_snapshot,
            resource_plan_id=db_plan.id,
        )
        self.db.delete(db_plan)
        self.db.commit()
        return True

    def get_tbd_positions(
        self,
        *,
        year: Optional[int] = None,
        month: Optional[int] = None,
        project_id: Optional[str] = None,
    ) -> List[dict]:
        """Get all TBD (unassigned) positions"""
        return self.get_multi(
            year=year,
            month=month,
            project_id=project_id,
            tbd_only=True,
        )

    def assign_user(
        self, plan_id: int, user_id: str, actor_user_id: str, actor_user_name: str
    ) -> Optional[dict]:
        """Assign a user to a TBD position"""
        db_plan = self.db.query(ResourcePlan).filter(ResourcePlan.id == plan_id).first()
        if not db_plan:
            return None

        # Check if user exists
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")

        # Check if already assigned
        if db_plan.user_id is not None:
            raise ValueError("This position is already assigned to a user")

        before_snapshot = self._serialize_plan_snapshot(db_plan)
        db_plan.user_id = user_id
        self.db.commit()
        self.db.refresh(db_plan)
        self._log_history(
            change_type="assign",
            actor_user_id=actor_user_id,
            actor_user_name=actor_user_name,
            before_snapshot=before_snapshot,
            after_snapshot=self._serialize_plan_snapshot(db_plan),
            resource_plan_id=db_plan.id,
        )
        self.db.commit()

        return self.get_by_id(plan_id)

    def get_job_positions(self) -> List[JobPosition]:
        """Get all active job positions"""
        return (
            self.db.query(JobPosition)
            .filter(JobPosition.is_active == True)
            .order_by(JobPosition.name)
            .all()
        )

    def get_summary_by_project(self) -> List[dict]:
        """Get monthly HC summary grouped by project"""
        from sqlalchemy import func

        results = (
            self.db.query(
                ResourcePlan.project_id,
                ResourcePlan.year,
                ResourcePlan.month,
                func.sum(ResourcePlan.planned_hours).label("total_hours"),
            )
            .join(Project, ResourcePlan.project_id == Project.id)
            .group_by(ResourcePlan.project_id, ResourcePlan.year, ResourcePlan.month)
            .order_by(ResourcePlan.year, ResourcePlan.month, ResourcePlan.project_id)
            .all()
        )

        # Get project info
        project_map = {}
        for r in results:
            if r.project_id not in project_map:
                project = (
                    self.db.query(Project)
                    .options(joinedload(Project.internal_io))
                    .filter(Project.id == r.project_id)
                    .first()
                )
                if project:
                    project_map[r.project_id] = {
                        "id": project.id,
                        "code": get_io_number(project),
                        "name": project.name,
                    }

        return [
            {
                "project_id": r.project_id,
                "project_code": project_map.get(r.project_id, {}).get("code"),
                "project_name": project_map.get(r.project_id, {}).get("name"),
                "year": r.year,
                "month": r.month,
                "total_hours": float(r.total_hours) if r.total_hours else 0,
            }
            for r in results
        ]

    def get_summary_by_position(self) -> List[dict]:
        """Get monthly HC summary grouped by position"""
        from sqlalchemy import func

        results = (
            self.db.query(
                ResourcePlan.position_id,
                ResourcePlan.year,
                ResourcePlan.month,
                func.sum(ResourcePlan.planned_hours).label("total_hours"),
                func.count(ResourcePlan.id).label("count"),
            )
            .join(JobPosition, ResourcePlan.position_id == JobPosition.id)
            .group_by(ResourcePlan.position_id, ResourcePlan.year, ResourcePlan.month)
            .order_by(ResourcePlan.year, ResourcePlan.month, ResourcePlan.position_id)
            .all()
        )

        # Get position info
        position_map = {}
        for r in results:
            if r.position_id not in position_map:
                position = (
                    self.db.query(JobPosition)
                    .filter(JobPosition.id == r.position_id)
                    .first()
                )
                if position:
                    position_map[r.position_id] = {
                        "id": position.id,
                        "name": position.name,
                    }

        return [
            {
                "position_id": r.position_id,
                "position_name": position_map.get(r.position_id, {}).get("name"),
                "year": r.year,
                "month": r.month,
                "total_hours": float(r.total_hours) if r.total_hours else 0,
                "count": r.count,
            }
            for r in results
        ]
