import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

import depot_client


@pytest.fixture(autouse=True)
def no_live_depot(monkeypatch):
    """Tests never reach a live Conway's Depot: milestones are recorded here instead of posted
    to a real project Journal, and the project list comes from cases only."""
    posted = []
    monkeypatch.setattr(depot_client, "post_milestone", lambda project, person_id, body: posted.append((project, person_id, body)) or True)
    monkeypatch.setattr(depot_client, "fetch_project_names", lambda: [])
    monkeypatch.setattr(depot_client, "fetch_people", lambda: [])
    return posted
