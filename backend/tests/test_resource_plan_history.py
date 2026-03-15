from types import SimpleNamespace

from app.core.security import get_current_user


def _create_user(db_session, user_id: str, email: str, position_id: str, role: str = "ADMIN"):
    from app.models.user import User

    user = User(
        id=user_id,
        email=email,
        hashed_password="hashed",
        name=email.split("@", 1)[0],
        korean_name=f"{user_id}-ko",
        position_id=position_id,
        role=role,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _create_project(db_session, project_id: str):
    from app.models.project import Project

    project = Project(
        id=project_id,
        name=f"Project {project_id}",
        status="InProgress",
        category="PRODUCT",
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


def _create_project_role(db_session, role_id: str, name: str = "SW Engineer"):
    from app.models.organization import ProjectRole

    role = ProjectRole(id=role_id, name=name, is_active=True)
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)
    return role


def test_resource_plan_history_records_create_update_delete_and_skips_noop(client, db_session, sample_position):
    from app.main import app

    actor = _create_user(db_session, "actor-admin", "actor@example.com", sample_position.id)
    assignee = _create_user(
        db_session, "assignee-user", "assignee@example.com", sample_position.id, role="USER"
    )
    project = _create_project(db_session, "project-history-1")
    project_role = _create_project_role(db_session, "ROLE_HISTORY_1")

    app.dependency_overrides[get_current_user] = lambda: actor

    try:
        create_response = client.post(
            "/api/resource-plans",
            json={
                "project_id": project.id,
                "year": 2026,
                "month": 4,
                "position_id": sample_position.id,
                "project_role_id": project_role.id,
                "user_id": assignee.id,
                "planned_hours": 0.5,
            },
        )
        assert create_response.status_code == 201
        plan_id = create_response.json()["id"]

        update_response = client.put(
            f"/api/resource-plans/{plan_id}",
            json={"planned_hours": 0.8},
        )
        assert update_response.status_code == 200

        noop_response = client.put(
            f"/api/resource-plans/{plan_id}",
            json={"planned_hours": 0.8},
        )
        assert noop_response.status_code == 200

        delete_response = client.delete(f"/api/resource-plans/{plan_id}")
        assert delete_response.status_code == 204
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    history_response = client.get(
        "/api/resource-plans/history",
        params={
            "project_id": project.id,
            "position_id": sample_position.id,
            "project_role_id": project_role.id,
            "user_id": assignee.id,
        },
    )

    assert history_response.status_code == 200
    history = history_response.json()
    assert [entry["change_type"] for entry in history] == ["delete", "update", "create"]
    assert all(entry["actor_user_id"] == actor.id for entry in history)
    assert all(entry["actor_user_name"] == actor.korean_name for entry in history)
    assert history[1]["before_values"]["planned_hours"] == 0.5
    assert history[1]["after_values"]["planned_hours"] == 0.8


def test_resource_plan_history_returns_tbd_assignments(client, db_session, sample_position):
    from app.main import app

    actor = _create_user(db_session, "actor-admin-2", "actor2@example.com", sample_position.id)
    assignee = _create_user(
        db_session, "assignee-user-2", "assignee2@example.com", sample_position.id, role="USER"
    )
    project = _create_project(db_session, "project-history-2")
    project_role = _create_project_role(db_session, "ROLE_HISTORY_2", name="Mechanical")

    app.dependency_overrides[get_current_user] = lambda: actor

    try:
        create_response = client.post(
            "/api/resource-plans",
            json={
                "project_id": project.id,
                "year": 2026,
                "month": 5,
                "position_id": sample_position.id,
                "project_role_id": project_role.id,
                "user_id": None,
                "planned_hours": 1.0,
            },
        )
        assert create_response.status_code == 201
        plan_id = create_response.json()["id"]

        assign_response = client.post(
            f"/api/resource-plans/{plan_id}/assign",
            json={"user_id": assignee.id},
        )
        assert assign_response.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    tbd_history_response = client.get(
        "/api/resource-plans/history",
        params={
            "project_id": project.id,
            "position_id": sample_position.id,
            "project_role_id": project_role.id,
            "is_tbd": "true",
        },
    )
    assert tbd_history_response.status_code == 200
    tbd_history = tbd_history_response.json()
    assert [entry["change_type"] for entry in tbd_history] == ["create"]

    assigned_history_response = client.get(
        "/api/resource-plans/history",
        params={
            "project_id": project.id,
            "position_id": sample_position.id,
            "project_role_id": project_role.id,
            "user_id": assignee.id,
        },
    )
    assert assigned_history_response.status_code == 200
    assigned_history = assigned_history_response.json()
    assert [entry["change_type"] for entry in assigned_history] == ["assign"]
    assert assigned_history[0]["before_values"]["user_id"] is None
    assert assigned_history[0]["after_values"]["user_id"] == assignee.id
