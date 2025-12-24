"""
Service layer for Work Type Categories
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.work_type import WorkTypeCategory, WorkTypeLegacyMapping
from app.schemas.work_type import (
    WorkTypeCategoryCreate,
    WorkTypeCategoryUpdate,
    WorkTypeCategoryTree,
)


class WorkTypeCategoryService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self, is_active: Optional[bool] = True) -> List[WorkTypeCategory]:
        """Get all categories"""
        query = self.db.query(WorkTypeCategory)
        if is_active is not None:
            query = query.filter(WorkTypeCategory.is_active == is_active)
        return query.order_by(WorkTypeCategory.level, WorkTypeCategory.sort_order).all()

    def get_by_id(self, category_id: int) -> Optional[WorkTypeCategory]:
        """Get category by ID"""
        return (
            self.db.query(WorkTypeCategory)
            .filter(WorkTypeCategory.id == category_id)
            .first()
        )

    def get_by_code(self, code: str) -> Optional[WorkTypeCategory]:
        """Get category by code"""
        return (
            self.db.query(WorkTypeCategory)
            .filter(WorkTypeCategory.code == code)
            .first()
        )

    def get_by_level(
        self, level: int, is_active: bool = True
    ) -> List[WorkTypeCategory]:
        """Get categories by level (1, 2, or 3)"""
        return (
            self.db.query(WorkTypeCategory)
            .filter(
                WorkTypeCategory.level == level,
                WorkTypeCategory.is_active == is_active,
            )
            .order_by(WorkTypeCategory.sort_order)
            .all()
        )

    def get_children(
        self, parent_id: int, is_active: bool = True
    ) -> List[WorkTypeCategory]:
        """Get child categories of a parent"""
        return (
            self.db.query(WorkTypeCategory)
            .filter(
                WorkTypeCategory.parent_id == parent_id,
                WorkTypeCategory.is_active == is_active,
            )
            .order_by(WorkTypeCategory.sort_order)
            .all()
        )

    def get_by_role(
        self, role: str, level: Optional[int] = None
    ) -> List[WorkTypeCategory]:
        """Get categories applicable to a specific role"""
        query = self.db.query(WorkTypeCategory).filter(
            WorkTypeCategory.is_active == True,
            (WorkTypeCategory.applicable_roles.is_(None))
            | (WorkTypeCategory.applicable_roles.contains(role)),
        )
        if level:
            query = query.filter(WorkTypeCategory.level == level)
        return query.order_by(WorkTypeCategory.level, WorkTypeCategory.sort_order).all()

    def get_tree(self) -> List[WorkTypeCategoryTree]:
        """Get full category tree (L1 with nested L2 and L3)"""
        # Get all L1 categories
        l1_categories = self.get_by_level(1)
        tree = []

        for l1 in l1_categories:
            l1_node = WorkTypeCategoryTree(
                id=l1.id,
                code=l1.code,
                name=l1.name,
                name_ko=l1.name_ko,
                level=l1.level,
                children=[],
            )

            # Get L2 children
            l2_categories = self.get_children(l1.id)
            for l2 in l2_categories:
                l2_node = WorkTypeCategoryTree(
                    id=l2.id,
                    code=l2.code,
                    name=l2.name,
                    name_ko=l2.name_ko,
                    level=l2.level,
                    children=[],
                )

                # Get L3 children
                l3_categories = self.get_children(l2.id)
                for l3 in l3_categories:
                    l3_node = WorkTypeCategoryTree(
                        id=l3.id,
                        code=l3.code,
                        name=l3.name,
                        name_ko=l3.name_ko,
                        level=l3.level,
                        children=[],
                    )
                    l2_node.children.append(l3_node)

                l1_node.children.append(l2_node)

            tree.append(l1_node)

        return tree

    def create(self, category_in: WorkTypeCategoryCreate) -> WorkTypeCategory:
        """Create a new category"""
        db_category = WorkTypeCategory(**category_in.model_dump())
        self.db.add(db_category)
        self.db.commit()
        self.db.refresh(db_category)
        return db_category

    def update(
        self, category_id: int, category_in: WorkTypeCategoryUpdate
    ) -> Optional[WorkTypeCategory]:
        """Update a category"""
        db_category = self.get_by_id(category_id)
        if not db_category:
            return None

        update_data = category_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_category, key, value)

        self.db.commit()
        self.db.refresh(db_category)
        return db_category

    def get_legacy_mapping(
        self, legacy_work_type: str
    ) -> Optional[WorkTypeLegacyMapping]:
        """Get the new category for a legacy work_type string"""
        return (
            self.db.query(WorkTypeLegacyMapping)
            .filter(WorkTypeLegacyMapping.legacy_work_type == legacy_work_type)
            .first()
        )

    def get_all_legacy_mappings(self) -> List[WorkTypeLegacyMapping]:
        """Get all legacy mappings"""
        return self.db.query(WorkTypeLegacyMapping).all()
