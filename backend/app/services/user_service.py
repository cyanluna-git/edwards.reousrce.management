"""
Service layer for user-related business logic
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.security import get_password_hash
from app.models.user import User, UserHistory
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: str) -> Optional[User]:
        """Get a user by their ID."""
        return self.db.query(User).filter(User.id == user_id).first()

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
            remarks="Initial user creation."
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
        department_id: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> List[User]:
        """Retrieve multiple users with filters and pagination."""
        query = self.db.query(User)

        if department_id is not None:
            query = query.filter(User.department_id == department_id)

        if is_active is not None:
            query = query.filter(User.is_active == is_active)

        return query.offset(skip).limit(limit).all()

    def update(self, user: User, user_in: UserUpdate) -> User:
        """Update a user and log history for significant changes."""
        update_data = user_in.model_dump(exclude_unset=True)
        
        # Check for changes that require history logging
        history_fields = ["department_id", "sub_team_id", "position_id"]
        if any(field in update_data and getattr(user, field) != update_data[field] for field in history_fields):
            self._log_history_change(user, update_data)

        # Handle password update separately
        if "password" in update_data and update_data["password"]:
            hashed_password = get_password_hash(update_data["password"])
            del update_data["password"]
            user.hashed_password = hashed_password

        for field, value in update_data.items():
            setattr(user, field, value)

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _log_history_change(self, user: User, update_data: dict):
        """Logs changes in a user's department, sub-team, or position."""
        now = datetime.utcnow()

        # End the current history record
        current_history = (
            self.db.query(UserHistory)
            .filter(UserHistory.user_id == user.id, UserHistory.end_date == None)
            .first()
        )
        if current_history:
            current_history.end_date = now

        # Create a new history record
        new_history = UserHistory(
            user_id=user.id,
            department_id=update_data.get("department_id", user.department_id),
            sub_team_id=update_data.get("sub_team_id", user.sub_team_id),
            position_id=update_data.get("position_id", user.position_id),
            start_date=now,
            change_type="TRANSFER", # Simple type for now, could be enhanced
            remarks="User profile updated."
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
