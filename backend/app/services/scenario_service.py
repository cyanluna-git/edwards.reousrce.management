"""
Service layer for scenario-related business logic
"""

from typing import List, Optional
from datetime import timedelta
from sqlalchemy.orm import Session, joinedload

from app.models.scenario import ProjectScenario, ScenarioMilestone
from app.models.project import ProjectMilestone
from app.schemas.scenario import (
    ProjectScenarioCreate,
    ProjectScenarioUpdate,
    ScenarioMilestoneCreate,
    ScenarioMilestoneUpdate,
    ScenarioComparisonResult,
    MilestoneComparison,
    CopyScenarioRequest,
)


class ScenarioService:
    def __init__(self, db: Session):
        self.db = db

    # ============ Scenario CRUD ============

    def get_scenario_by_id(self, scenario_id: int) -> Optional[ProjectScenario]:
        """Get a scenario by its ID with milestones."""
        return (
            self.db.query(ProjectScenario)
            .options(joinedload(ProjectScenario.milestones))
            .filter(ProjectScenario.id == scenario_id)
            .first()
        )

    def get_scenarios_by_project(self, project_id: str) -> List[ProjectScenario]:
        """Get all scenarios for a project."""
        return (
            self.db.query(ProjectScenario)
            .options(joinedload(ProjectScenario.milestones))
            .filter(ProjectScenario.project_id == project_id)
            .order_by(ProjectScenario.is_baseline.desc(), ProjectScenario.created_at)
            .all()
        )

    def create_scenario(
        self, project_id: str, scenario_in: ProjectScenarioCreate
    ) -> ProjectScenario:
        """Create a new scenario with optional milestones."""
        # If this is the first scenario or is_baseline=True, ensure only one baseline
        if scenario_in.is_baseline:
            self.db.query(ProjectScenario).filter(
                ProjectScenario.project_id == project_id,
                ProjectScenario.is_baseline == True,
            ).update({"is_baseline": False})

        scenario = ProjectScenario(
            project_id=project_id,
            name=scenario_in.name,
            description=scenario_in.description,
            is_active=scenario_in.is_active,
            is_baseline=scenario_in.is_baseline,
        )
        self.db.add(scenario)
        self.db.flush()  # Get ID before adding milestones

        # Add milestones if provided
        if scenario_in.milestones:
            for ms_data in scenario_in.milestones:
                milestone = ScenarioMilestone(
                    scenario_id=scenario.id, **ms_data.model_dump()
                )
                self.db.add(milestone)

        self.db.commit()
        self.db.refresh(scenario)
        return scenario

    def update_scenario(
        self, scenario_id: int, scenario_in: ProjectScenarioUpdate
    ) -> Optional[ProjectScenario]:
        """Update a scenario."""
        scenario = (
            self.db.query(ProjectScenario)
            .filter(ProjectScenario.id == scenario_id)
            .first()
        )
        if not scenario:
            return None

        update_data = scenario_in.model_dump(exclude_unset=True)

        # If setting as baseline, remove baseline from others
        if update_data.get("is_baseline"):
            self.db.query(ProjectScenario).filter(
                ProjectScenario.project_id == scenario.project_id,
                ProjectScenario.id != scenario_id,
                ProjectScenario.is_baseline == True,
            ).update({"is_baseline": False})

        for key, value in update_data.items():
            setattr(scenario, key, value)

        self.db.commit()
        self.db.refresh(scenario)
        return scenario

    def delete_scenario(self, scenario_id: int) -> bool:
        """Delete a scenario and its milestones."""
        scenario = (
            self.db.query(ProjectScenario)
            .filter(ProjectScenario.id == scenario_id)
            .first()
        )
        if not scenario:
            return False

        self.db.delete(scenario)
        self.db.commit()
        return True

    # ============ Milestone CRUD ============

    def add_milestone(
        self, scenario_id: int, milestone_in: ScenarioMilestoneCreate
    ) -> ScenarioMilestone:
        """Add a milestone to a scenario."""
        milestone = ScenarioMilestone(
            scenario_id=scenario_id, **milestone_in.model_dump()
        )
        self.db.add(milestone)
        self.db.commit()
        self.db.refresh(milestone)
        return milestone

    def update_milestone(
        self, milestone_id: int, milestone_in: ScenarioMilestoneUpdate
    ) -> Optional[ScenarioMilestone]:
        """Update a milestone."""
        milestone = (
            self.db.query(ScenarioMilestone)
            .filter(ScenarioMilestone.id == milestone_id)
            .first()
        )
        if not milestone:
            return None

        update_data = milestone_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(milestone, key, value)

        self.db.commit()
        self.db.refresh(milestone)
        return milestone

    def delete_milestone(self, milestone_id: int) -> bool:
        """Delete a milestone."""
        milestone = (
            self.db.query(ScenarioMilestone)
            .filter(ScenarioMilestone.id == milestone_id)
            .first()
        )
        if not milestone:
            return False

        self.db.delete(milestone)
        self.db.commit()
        return True

    # ============ Copy & Compare ============

    def copy_scenario(
        self, scenario_id: int, copy_request: CopyScenarioRequest
    ) -> Optional[ProjectScenario]:
        """Copy an existing scenario with optional date offset."""
        source = self.get_scenario_by_id(scenario_id)
        if not source:
            return None

        offset = timedelta(days=copy_request.date_offset_days)

        # Create new scenario
        new_scenario = ProjectScenario(
            project_id=source.project_id,
            name=copy_request.new_name,
            description=f"Copied from {source.name}",
            is_active=False,
            is_baseline=False,
        )
        self.db.add(new_scenario)
        self.db.flush()

        # Copy milestones with date offset
        for ms in source.milestones:
            new_milestone = ScenarioMilestone(
                scenario_id=new_scenario.id,
                base_milestone_id=ms.base_milestone_id,
                name=ms.name,
                type=ms.type,
                target_date=ms.target_date + offset,
                actual_date=ms.actual_date + offset if ms.actual_date else None,
                status=ms.status,
                is_key_gate=ms.is_key_gate,
                notes=ms.notes,
                sort_order=ms.sort_order,
            )
            self.db.add(new_milestone)

        self.db.commit()
        self.db.refresh(new_scenario)
        return new_scenario

    def compare_scenarios(
        self, scenario_1_id: int, scenario_2_id: int
    ) -> Optional[ScenarioComparisonResult]:
        """Compare two scenarios and return milestone differences."""
        scenario_1 = self.get_scenario_by_id(scenario_1_id)
        scenario_2 = self.get_scenario_by_id(scenario_2_id)

        if not scenario_1 or not scenario_2:
            return None

        # Build mapping by milestone name
        ms_1_map = {ms.name: ms for ms in scenario_1.milestones}
        ms_2_map = {ms.name: ms for ms in scenario_2.milestones}

        all_names = set(ms_1_map.keys()) | set(ms_2_map.keys())
        comparisons = []
        total_delta = 0

        for name in sorted(all_names):
            ms_1 = ms_1_map.get(name)
            ms_2 = ms_2_map.get(name)

            date_1 = ms_1.target_date if ms_1 else None
            date_2 = ms_2.target_date if ms_2 else None

            delta = None
            if date_1 and date_2:
                delta = (date_2 - date_1).days
                total_delta += delta

            comparisons.append(
                MilestoneComparison(
                    milestone_name=name,
                    scenario_1_date=date_1,
                    scenario_2_date=date_2,
                    delta_days=delta,
                )
            )

        return ScenarioComparisonResult(
            scenario_1_id=scenario_1_id,
            scenario_1_name=scenario_1.name,
            scenario_2_id=scenario_2_id,
            scenario_2_name=scenario_2.name,
            milestone_comparisons=comparisons,
            total_delta_days=total_delta,
        )

    def create_baseline_from_milestones(self, project_id: str) -> ProjectScenario:
        """Create a baseline scenario from existing project milestones."""
        existing_milestones = (
            self.db.query(ProjectMilestone)
            .filter(ProjectMilestone.project_id == project_id)
            .order_by(ProjectMilestone.target_date)
            .all()
        )

        scenario = ProjectScenario(
            project_id=project_id,
            name="Baseline",
            description="Auto-generated from project milestones",
            is_active=True,
            is_baseline=True,
        )
        self.db.add(scenario)
        self.db.flush()

        for idx, pm in enumerate(existing_milestones):
            milestone = ScenarioMilestone(
                scenario_id=scenario.id,
                base_milestone_id=pm.id,
                name=pm.name,
                type=pm.type,
                target_date=pm.target_date,
                actual_date=pm.actual_date,
                status=pm.status,
                is_key_gate=pm.is_key_gate,
                notes=pm.description,
                sort_order=idx,
            )
            self.db.add(milestone)

        self.db.commit()
        self.db.refresh(scenario)
        return scenario
