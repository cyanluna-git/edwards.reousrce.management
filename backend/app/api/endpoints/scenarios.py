"""
Scenarios API endpoints
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.scenario import (
    ProjectScenario,
    ProjectScenarioCreate,
    ProjectScenarioUpdate,
    ScenarioMilestone,
    ScenarioMilestoneCreate,
    ScenarioMilestoneUpdate,
    ScenarioComparisonResult,
    CopyScenarioRequest,
)
from app.services.scenario_service import ScenarioService

router = APIRouter()


# ============ Project Scenarios ============


@router.get("/projects/{project_id}/scenarios", response_model=List[ProjectScenario])
async def list_project_scenarios(project_id: str, db: Session = Depends(get_db)):
    """Get all scenarios for a project."""
    service = ScenarioService(db)
    return service.get_scenarios_by_project(project_id)


@router.post(
    "/projects/{project_id}/scenarios",
    response_model=ProjectScenario,
    status_code=status.HTTP_201_CREATED,
)
async def create_scenario(
    project_id: str, scenario_in: ProjectScenarioCreate, db: Session = Depends(get_db)
):
    """Create a new scenario for a project."""
    service = ScenarioService(db)
    return service.create_scenario(project_id, scenario_in)


@router.post(
    "/projects/{project_id}/scenarios/from-milestones",
    response_model=ProjectScenario,
    status_code=status.HTTP_201_CREATED,
)
async def create_baseline_from_milestones(
    project_id: str, db: Session = Depends(get_db)
):
    """Create a baseline scenario from existing project milestones."""
    service = ScenarioService(db)
    return service.create_baseline_from_milestones(project_id)


@router.get("/scenarios/{scenario_id}", response_model=ProjectScenario)
async def get_scenario(scenario_id: int, db: Session = Depends(get_db)):
    """Get a scenario by ID."""
    service = ScenarioService(db)
    scenario = service.get_scenario_by_id(scenario_id)
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found"
        )
    return scenario


@router.put("/scenarios/{scenario_id}", response_model=ProjectScenario)
async def update_scenario(
    scenario_id: int, scenario_in: ProjectScenarioUpdate, db: Session = Depends(get_db)
):
    """Update a scenario."""
    service = ScenarioService(db)
    scenario = service.update_scenario(scenario_id, scenario_in)
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found"
        )
    return scenario


@router.delete("/scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scenario(scenario_id: int, db: Session = Depends(get_db)):
    """Delete a scenario."""
    service = ScenarioService(db)
    if not service.delete_scenario(scenario_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found"
        )
    return None


@router.post("/scenarios/{scenario_id}/copy", response_model=ProjectScenario)
async def copy_scenario(
    scenario_id: int, copy_request: CopyScenarioRequest, db: Session = Depends(get_db)
):
    """Copy a scenario with optional date offset."""
    service = ScenarioService(db)
    new_scenario = service.copy_scenario(scenario_id, copy_request)
    if not new_scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source scenario not found"
        )
    return new_scenario


@router.get("/scenarios/compare", response_model=ScenarioComparisonResult)
async def compare_scenarios(
    scenario_1_id: int = Query(...),
    scenario_2_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Compare two scenarios and return milestone differences."""
    service = ScenarioService(db)
    result = service.compare_scenarios(scenario_1_id, scenario_2_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both scenarios not found",
        )
    return result


# ============ Scenario Milestones ============


@router.post(
    "/scenarios/{scenario_id}/milestones",
    response_model=ScenarioMilestone,
    status_code=status.HTTP_201_CREATED,
)
async def add_milestone(
    scenario_id: int,
    milestone_in: ScenarioMilestoneCreate,
    db: Session = Depends(get_db),
):
    """Add a milestone to a scenario."""
    service = ScenarioService(db)
    return service.add_milestone(scenario_id, milestone_in)


@router.put("/milestones/{milestone_id}", response_model=ScenarioMilestone)
async def update_milestone(
    milestone_id: int,
    milestone_in: ScenarioMilestoneUpdate,
    db: Session = Depends(get_db),
):
    """Update a scenario milestone."""
    service = ScenarioService(db)
    milestone = service.update_milestone(milestone_id, milestone_in)
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    return milestone


@router.delete("/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(milestone_id: int, db: Session = Depends(get_db)):
    """Delete a scenario milestone."""
    service = ScenarioService(db)
    if not service.delete_milestone(milestone_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    return None
