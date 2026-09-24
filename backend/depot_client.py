"""
A thin, read-only client for Conway's Depot, for the two things The Fixer shows that the Depot
owns: who's using the app (the ecosystem's "viewing as" persona list) and which projects exist
(so a new case can be filed against a project that has no cases yet), plus posting case
milestones to a project's Journal. Cases still carry their project as a plain-text name; The
Fixer never stores a Depot id. Every call tolerates the Depot being down.
"""

import os

import httpx

DEPOT_API_URL = os.environ.get("DEPOT_API_URL", "http://localhost:8090").rstrip("/")


def _get(path: str):
    try:
        r = httpx.get(f"{DEPOT_API_URL}{path}", timeout=3.0)
        return r.json() if r.status_code == 200 else None
    except (httpx.HTTPError, ValueError):
        return None


def fetch_people() -> list[dict] | None:
    return _get("/api/people")


def fetch_project_names() -> list[str] | None:
    projects = _get("/api/projects")
    return [p["name"] for p in projects] if isinstance(projects, list) else None


# This app's own id in the Depot's registry. A project's Fixer link carries the project NAME as
# its crosswalk ref, which is how a case's plain-text project resolves to a Depot project.
DEPOT_APPLICATION_ID = os.environ.get("DEPOT_APPLICATION_ID", "258a0d94-d960-479d-813f-aad09e66684e")


def post_milestone(project_name: str | None, person_id: str | None, body: str) -> bool:
    """Best-effort: post one line to the case's project Journal in the Depot, authored by the
    person who did it. A case with no project, no Depot link, or an unreachable Depot just
    doesn't get a Journal line; it never fails the change itself."""
    if not project_name:
        return False
    try:
        r = httpx.get(f"{DEPOT_API_URL}/api/applications/{DEPOT_APPLICATION_ID}/project-link",
                      params={"external_ref": project_name}, timeout=3.0)
        link = r.json() if r.status_code == 200 else None
    except (httpx.HTTPError, ValueError):
        link = None
    project_id = (link or {}).get("project_id")
    if not project_id:
        return False
    try:
        r = httpx.post(f"{DEPOT_API_URL}/api/projects/{project_id}/notes",
                       json={"person_id": person_id, "body": body}, timeout=3.0)
        return r.status_code == 201
    except httpx.HTTPError:
        return False
