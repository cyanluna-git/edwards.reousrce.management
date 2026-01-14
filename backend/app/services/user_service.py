"""
Service layer for user-related business logic
"""
from typing import List, Optional
from typing import cast
from sqlalchemy.orm import Session, joinedload
from datetime import datetime

from app.core.security import get_password_hash
from app.models.user import User, UserHistory
from app.models.organization import SubTeam
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def _get_department_id_for_sub_team_id(self, sub_team_id: Optional[str]) -> Optional[str]:
        if not sub_team_id:
            return None
        sub_team = (
            self.db.query(SubTeam).filter(SubTeam.id == sub_team_id).first()
        )
        if not sub_team:
            return None
        return cast(str, sub_team.department_id)

    def get_by_id(self, user_id: str) -> Optional[User]:
        """Get a user by their ID."""
        return self.db.query(User).options(joinedload(User.sub_team)).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> Optional[User]:
        """Get a user by their email."""
        return self.db.query(User).filter(User.email == email).first()

    def create_user(self, user_in: UserCreate) -> User:
        """Create a new user and their initial history record."""
        hashed_password = get_password_hash(user_in.password)
        db_user = User(
            **user_in.model_dump(exclude={"password"}),
            hashed_password=hashed_password
        )
        self.db.add(db_user)
        self.db.flush()  # Flush to get the db_user.id if it's auto-generated

        # Create initial history record
        initial_history = UserHistory(
            user_id=db_user.id,
            department_id=db_user.department_id,
            sub_team_id=db_user.sub_team_id,
            position_id=db_user.position_id,
            start_date=db_user.created_at or datetime.utcnow(),
            change_type="HIRE",
            remarks="Initial user creation.",
        )
        self.db.add(initial_history)
        
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        department_id: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[User]:
        """Retrieve multiple users with filters and pagination."""
        query = self.db.query(User).options(joinedload(User.sub_team))

        if department_id is not None:
            query = query.filter(User.department_id == department_id)

        if is_active is not None:
            query = query.filter(User.is_active == is_active)

        return query.offset(skip).limit(limit).all()

    def update(self, user: User, user_in: UserUpdate) -> User:
        """Update a user and log history for significant changes."""
        update_data = user_in.model_dump(exclude_unset=True)

        # Capture pre-update values for history logging
        old_department_id = user.department_id
        old_sub_team_id = user.sub_team_id
        old_position_id = user.position_id

        # Handle password update separately
        if "password" in update_data and update_data["password"]:
            hashed_password = get_password_hash(update_data["password"])
            del update_data["password"]
            user.hashed_password = hashed_password

        for field, value in update_data.items():
            setattr(user, field, value)

        self.db.add(user)

        # Log history changes after applying updates
        self.db.flush()
        new_department_id = user.department_id
        new_sub_team_id = user.sub_team_id
        new_position_id = user.position_id
        org_changed = (old_department_id != new_department_id) or (
            old_sub_team_id != new_sub_team_id
        ) or (old_position_id != new_position_id)
        
        if org_changed:
            self._log_history_change(
                user_id=cast(str, user.id),
                department_id=cast(str, new_department_id),
                sub_team_id=cast(Optional[str], new_sub_team_id),
                position_id=cast(str, new_position_id),
            )
        self.db.commit()
        self.db.refresh(user)
        return user

    def _log_history_change(
        self,
        *,
        user_id: str,
        department_id: str,
        sub_team_id: Optional[str],
        position_id: str,
        change_type: str = "TRANSFER",
        remarks: str = "User profile updated.",
    ):
        """Logs changes in a user's department/sub-team/position."""
        now = datetime.utcnow()

        # End the current history record
        current_history = (
            self.db.query(UserHistory)
            .filter(UserHistory.user_id == user_id, UserHistory.end_date.is_(None))
            .first()
        )
        if current_history:
            current_history.end_date = now

        # Create a new history record
        new_history = UserHistory(
            user_id=user_id,
            department_id=department_id,
            sub_team_id=sub_team_id,
            position_id=position_id,
            start_date=now,
            change_type=change_type,
            remarks=remarks,
        )
        self.db.add(new_history)

    def get_history_by_user_id(self, user_id: str) -> List[UserHistory]:
        """Retrieve the change history for a specific user."""
        return (
            self.db.query(UserHistory)
            .filter(UserHistory.user_id == user_id)
            .order_by(UserHistory.start_date.desc())
            .all()
        )

    def delete(self, user_id: str) -> Optional[User]:
        """Soft delete a user by setting is_active to False."""
        user = self.get_by_id(user_id)
        if user:
            user.is_active = False
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
        return user
