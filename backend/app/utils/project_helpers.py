"""
Project utility functions for consistent data access patterns.
"""

from typing import Optional, Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.project import Project


def get_io_number(project: "Project") -> Optional[str]:
    """
    Safely get the IO number from a project's internal_io relationship.

    Args:
        project: Project model instance

    Returns:
        IO number string or None if not set
    """
    return project.internal_io.io_number if project.internal_io else None


def get_project_display_code(project: "Project") -> str:
    """
    Get a display code for a project, falling back to truncated ID if no IO.

    Args:
        project: Project model instance

    Returns:
        IO number or first 8 chars of project ID
    """
    if project.internal_io:
        return project.internal_io.io_number
    return project.id[:8] if project.id else "-"


def project_to_summary_dict(project: "Project") -> Dict[str, Any]:
    """
    Convert a project to a summary dictionary with consistent structure.

    Args:
        project: Project model instance

    Returns:
        Dictionary with id, code, name, and optionally internal_io details
    """
    return {
        "id": project.id,
        "code": get_io_number(project),
        "name": project.name,
        "internal_io": {
            "io_number": project.internal_io.io_number,
            "name": project.internal_io.name,
        } if project.internal_io else None,
    }


def project_to_hierarchy_dict(project: "Project") -> Dict[str, Any]:
    """
    Convert a project to a hierarchy node dictionary.

    Args:
        project: Project model instance

    Returns:
        Dictionary formatted for hierarchy tree display
    """
    return {
        "id": project.id,
        "internal_io": {
            "io_number": project.internal_io.io_number,
            "name": project.internal_io.name,
        } if project.internal_io else None,
        "name": project.name,
        "status": project.status,
        "type": "project",
    }
