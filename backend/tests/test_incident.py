"""Regression guard for Incident.to_dict()'s computed fields — the only real logic here.
Runs against a throwaway DB (own DATA_DIR), never the real dev data."""

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import os  # noqa: E402

os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="thefixer-test-")

from app import create_app  # noqa: E402
from db import db  # noqa: E402
from models import Action, FishboneCause, Incident, WhyStep  # noqa: E402


def test_has_root_cause_and_action_counts():
    app = create_app()
    with app.app_context():
        incident = Incident(title="Test incident")
        db.session.add(incident)
        db.session.flush()
        db.session.add(WhyStep(incident_id=incident.id, sequence=1, question="Why?", answer="Because", is_root_cause=False))
        db.session.add(WhyStep(incident_id=incident.id, sequence=2, question="Why?", answer="Root", is_root_cause=True))
        db.session.add(Action(incident_id=incident.id, kind="corrective", description="Fix it", status="done"))
        db.session.add(Action(incident_id=incident.id, kind="preventive", description="Prevent it", status="verified"))
        db.session.commit()

        d = incident.to_dict()
        assert d["why_count"] == 2
        assert d["has_root_cause"] is True
        assert d["action_count"] == 2
        assert d["open_action_count"] == 1  # "done" isn't "verified" yet


def test_fishbone_count():
    app = create_app()
    with app.app_context():
        incident = Incident(title="Test incident")
        db.session.add(incident)
        db.session.flush()
        db.session.add(FishboneCause(incident_id=incident.id, category="machine", description="Worn fixture"))
        db.session.add(FishboneCause(incident_id=incident.id, category="method", description="No incoming check"))
        db.session.commit()

        d = incident.to_dict()
        assert d["fishbone_count"] == 2
