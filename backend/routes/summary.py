"""
The Launchpad's app-summary contract for The Fixer — the tile on a project's page in Conway's Depot
(see the Depot's routes/applications.py; it renders these fields opaquely).

The Fixer is Depot-unaware: a case carries its project as a plain-text *name*. So the Depot's
project link for this app stores that name as its external_ref, and the Depot passes it here as
`project_id` (its crosswalk translation). The tile's headline is the project's open cases, and it
links straight to the case list filtered to that project — a project sees only its own cases.
"""

import os
from urllib.parse import quote

from flask import Blueprint, jsonify, request

from models import Incident

bp = Blueprint("summary", __name__, url_prefix="/api")

FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:5177")


@bp.get("/summary")
def summary():
    project = request.args.get("project_id")
    base = Incident.query.filter_by(project=project) if project else Incident.query
    href = f"{FRONTEND_BASE_URL}/?project={quote(project)}" if project else f"{FRONTEND_BASE_URL}/"

    total = base.count()
    if project and total == 0:
        return jsonify({"headline": None, "label": "No cases for this project", "status": None, "href": href})

    open_n = base.filter(Incident.status != "closed").count()
    closed = total - open_n
    return jsonify({
        "headline": str(open_n),
        "label": (f"open case{'' if open_n == 1 else 's'}" + (f" · {closed} closed" if closed else "")),
        "status": "warn" if open_n else "ok",
        "href": href,
    })
