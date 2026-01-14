"""
Departments endpoints - Organization hierarchy management
BusinessUnit > Department > SubTeam
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models.organization import BusinessUnit, Department, SubTeam
from app.models.user import User

router = APIRouter()


# ============================================================
# Schemas
# ============================================================


class BusinessUnitBase(BaseModel):
    name: str
    code: str
    is_active: bool = True


class BusinessUnitCreate(BusinessUnitBase):
    pass


class BusinessUnitUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None


class BusinessUnitResponse(BusinessUnitBase):
    id: str

    class Config:
        from_attributes = True


class DepartmentBase(BaseModel):
    name: str
    code: str
    business_unit_id: Optional[str] = None
    division_id: Optional[str] = None  # NEW
    is_active: bool = True


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    business_unit_id: Optional[str] = None
    division_id: Optional[str] = None  # NEW
    is_active: Optional[bool] = None


class DepartmentResponse(DepartmentBase):
    id: str

    class Config:
        from_attributes = True


class SubTeamBase(BaseModel):
    name: str
    code: str
    department_id: str
    is_active: bool = True


class SubTeamCreate(SubTeamBase):
    pass


class SubTeamUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    department_id: Optional[str] = None
    is_active: Optional[bool] = None


class SubTeamResponse(SubTeamBase):
    id: str

    class Config:
        from_attributes = True


# ============================================================
# Business Units
# ============================================================


@router.get("/business-units", response_model=List[BusinessUnitResponse])
async def list_business_units(
    is_active: Optional[bool] = Query(
        True, description="Filter by active status. Default: only active."
    ),
    db: Session = Depends(get_db),
):
    """List all business units (default: active only)"""
    query = db.query(BusinessUnit)
    if is_active is not None:
        query = query.filter(BusinessUnit.is_active == is_active)
    return query.order_by(BusinessUnit.name).all()


@router.post(
    "/business-units",
    response_model=BusinessUnitResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_business_unit(
    bu_in: BusinessUnitCreate,
    db: Session = Depends(get_db),
):
    """Create a new business unit"""
    # Check for duplicate code
    existing = db.query(BusinessUnit).filter(BusinessUnit.code == bu_in.code).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Business Unit with code '{bu_in.code}' already exists",
        )

    bu = BusinessUnit(
        id=f"BU_{bu_in.code.upper()}",
        name=bu_in.name,
        code=bu_in.code,
        is_active=bu_in.is_active,
    )
    db.add(bu)
    db.commit()
    db.refresh(bu)
    return bu


@router.put("/business-units/{bu_id}", response_model=BusinessUnitResponse)
async def update_business_unit(
    bu_id: str,
    bu_in: BusinessUnitUpdate,
    db: Session = Depends(get_db),
):
    """Update a business unit"""
    bu = db.query(BusinessUnit).filter(BusinessUnit.id == bu_id).first()
    if not bu:
        raise HTTPException(status_code=404, detail="Business unit not found")

    if bu_in.name is not None:
        bu.name = bu_in.name
    if bu_in.code is not None:
        bu.code = bu_in.code
    if bu_in.is_active is not None:
        bu.is_active = bu_in.is_active

    db.commit()
    db.refresh(bu)
    return bu


@router.delete("/business-units/{bu_id}")
async def delete_business_unit(
    bu_id: str,
    db: Session = Depends(get_db),
):
    """Delete a business unit (soft delete by setting inactive)"""
    bu = db.query(BusinessUnit).filter(BusinessUnit.id == bu_id).first()
    if not bu:
        raise HTTPException(status_code=404, detail="Business unit not found")

    # Check for dependent departments (only active ones)
    dept_count = (
        db.query(Department)
        .filter(Department.business_unit_id == bu_id, Department.is_active == True)
        .count()
    )
    if dept_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {dept_count} active departments belong to this business unit",
        )

    bu.is_active = False
    db.commit()
    return {"message": "Business unit deactivated"}


# ============================================================
# Departments
# ============================================================


@router.get("", response_model=List[DepartmentResponse])
async def list_departments(
    business_unit_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(
        True, description="Filter by active status. Default: only active."
    ),
    db: Session = Depends(get_db),
):
    """List all departments with optional filters (default: active only)"""
    query = db.query(Department)
    if business_unit_id:
        query = query.filter(Department.business_unit_id == business_unit_id)
    if is_active is not None:
        query = query.filter(Department.is_active == is_active)
    return query.order_by(Department.name).all()


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    dept_in: DepartmentCreate,
    db: Session = Depends(get_db),
):
    """Create a new department"""
    # Verify business unit exists (only if provided)
    if dept_in.business_unit_id:
        bu = (
            db.query(BusinessUnit)
            .filter(BusinessUnit.id == dept_in.business_unit_id)
            .first()
        )
        if not bu:
            raise HTTPException(status_code=400, detail="Business unit not found")

    # Verify division exists (only if provided)
    if dept_in.division_id:
        from app.models.organization import Division

        div = db.query(Division).filter(Division.id == dept_in.division_id).first()
        if not div:
            raise HTTPException(status_code=400, detail="Division not found")

    dept = Department(
        id=f"DEPT_{dept_in.code.upper()}",
        name=dept_in.name,
        code=dept_in.code,
        business_unit_id=dept_in.business_unit_id,
        division_id=dept_in.division_id,
        is_active=dept_in.is_active,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: str,
    db: Session = Depends(get_db),
):
    """Get a specific department by ID"""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: str,
    dept_in: DepartmentUpdate,
    db: Session = Depends(get_db),
):
    """Update a department"""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    update_data = dept_in.model_dump(exclude_unset=True)

    if "name" in update_data:
        dept.name = update_data["name"]
    if "code" in update_data:
        dept.code = update_data["code"]
    if "business_unit_id" in update_data:
        dept.business_unit_id = update_data["business_unit_id"]
    if "division_id" in update_data:
        dept.division_id = update_data["division_id"]
    if "is_active" in update_data:
        dept.is_active = update_data["is_active"]

    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/{department_id}")
async def delete_department(
    department_id: str,
    db: Session = Depends(get_db),
):
    """Delete a department (soft delete)"""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    # Check for dependent sub-teams
    subteam_count = (
        db.query(SubTeam)
        .filter(SubTeam.department_id == department_id, SubTeam.is_active == True)
        .count()
    )
    if subteam_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {subteam_count} active sub-teams belong to this department",
        )

    # Check for dependent users (only active users)
    user_count = (
        db.query(User)
        .join(SubTeam, User.sub_team_id == SubTeam.id)
        .filter(SubTeam.department_id == department_id, User.is_active == True)
        .count()
    )
    if user_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {user_count} active users belong to this department",
        )

    dept.is_active = False
    db.commit()
    return {"message": "Department deactivated"}


@router.get("/{department_id}/members")
async def get_department_members(
    department_id: str,
    is_active: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
):
    """Get all members of a department"""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    query = (
        db.query(User)
        .join(SubTeam, User.sub_team_id == SubTeam.id)
        .filter(SubTeam.department_id == department_id)
    )
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    users = query.order_by(User.name).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "korean_name": u.korean_name,
            "email": u.email,
            "position_id": u.position_id,
            "sub_team_id": u.sub_team_id,
            "role": u.role,
            "is_active": u.is_active,
        }
        for u in users
    ]


@router.get("/{department_id}/sub-teams", response_model=List[SubTeamResponse])
async def get_department_sub_teams(
    department_id: str,
    is_active: Optional[bool] = Query(
        True, description="Filter by active status. Default: only active."
    ),
    db: Session = Depends(get_db),
):
    """Get sub-teams of a department (default: active only)"""
    query = db.query(SubTeam).filter(SubTeam.department_id == department_id)
    if is_active is not None:
        query = query.filter(SubTeam.is_active == is_active)
    return query.order_by(SubTeam.name).all()


# ============================================================
# Sub-Teams
# ============================================================


@router.post(
    "/{department_id}/sub-teams",
    response_model=SubTeamResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_sub_team(
    department_id: str,
    st_in: SubTeamCreate,
    db: Session = Depends(get_db),
):
    """Create a new sub-team under a department"""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    st = SubTeam(
        id=f"ST_{st_in.code.upper()}",
        name=st_in.name,
        code=st_in.code,
        department_id=department_id,
        is_active=st_in.is_active,
    )
    db.add(st)
    db.commit()
    db.refresh(st)
    return st


@router.put("/sub-teams/{sub_team_id}", response_model=SubTeamResponse)
async def update_sub_team(
    sub_team_id: str,
    st_in: SubTeamUpdate,
    db: Session = Depends(get_db),
):
    """Update a sub-team"""
    st = db.query(SubTeam).filter(SubTeam.id == sub_team_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Sub-team not found")

    if st_in.name is not None:
        st.name = st_in.name
    if st_in.code is not None:
        st.code = st_in.code
    if st_in.department_id is not None:
        st.department_id = st_in.department_id
    if st_in.is_active is not None:
        st.is_active = st_in.is_active

    db.commit()
    db.refresh(st)
    return st


@router.delete("/sub-teams/{sub_team_id}")
async def delete_sub_team(
    sub_team_id: str,
    db: Session = Depends(get_db),
):
    """Delete a sub-team (soft delete)"""
    st = db.query(SubTeam).filter(SubTeam.id == sub_team_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Sub-team not found")

    # Check for dependent users
    user_count = db.query(User).filter(User.sub_team_id == sub_team_id).count()
    if user_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {user_count} users belong to this sub-team",
        )

    st.is_active = False
    db.commit()
    return {"message": "Sub-team deactivated"}
