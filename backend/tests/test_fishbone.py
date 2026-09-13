"""Route-level tests for the fishbone brainstorm step and its promotion into the Why chain."""

import os
import sys

os.environ["DATA_DIR"] = os.path.join(os.path.dirname(__file__), "_tmp_fishbone_data")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import shutil

import pytest

from app import create_app
from db import db


@pytest.fixture()
def client():
    shutil.rmtree(os.environ["DATA_DIR"], ignore_errors=True)
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c
    with app.app_context():
        db.session.remove()
    shutil.rmtree(os.environ["DATA_DIR"], ignore_errors=True)


def _new_incident(client):
    res = client.post("/api/incidents", json={"title": "Test incident"})
    return res.get_json()["id"]


def test_add_cause_requires_known_category(client):
    incident_id = _new_incident(client)
    bad = client.post(f"/api/incidents/{incident_id}/fishbone-causes", json={
        "category": "moon-phase", "description": "Full moon",
    })
    assert bad.status_code == 400

    good = client.post(f"/api/incidents/{incident_id}/fishbone-causes", json={
        "category": "machine", "description": "Fixture out of calibration",
    })
    assert good.status_code == 201
    assert good.get_json()["promoted_why_step_id"] is None


def test_promote_starts_the_why_chain(client):
    incident_id = _new_incident(client)
    cause = client.post(f"/api/incidents/{incident_id}/fishbone-causes", json={
        "category": "method", "description": "No incoming inspection step for this material",
    }).get_json()

    promoted = client.post(f"/api/fishbone-causes/{cause['id']}/promote")
    assert promoted.status_code == 201
    body = promoted.get_json()
    assert body["why_step"]["sequence"] == 1
    assert body["why_step"]["answer"] == "No incoming inspection step for this material"
    assert body["cause"]["promoted_why_step_id"] == body["why_step"]["id"]

    incident = client.get(f"/api/incidents/{incident_id}").get_json()
    assert incident["why_count"] == 1


def test_cannot_promote_once_chain_has_started(client):
    incident_id = _new_incident(client)
    client.post(f"/api/incidents/{incident_id}/why-steps", json={"answer": "Something"})

    cause = client.post(f"/api/incidents/{incident_id}/fishbone-causes", json={
        "category": "man", "description": "Backup operators not cross-trained",
    }).get_json()

    res = client.post(f"/api/fishbone-causes/{cause['id']}/promote")
    assert res.status_code == 400


def test_cannot_promote_the_same_cause_twice(client):
    incident_id = _new_incident(client)
    cause = client.post(f"/api/incidents/{incident_id}/fishbone-causes", json={
        "category": "material", "description": "Supplier changed alloy without a deviation",
    }).get_json()

    first = client.post(f"/api/fishbone-causes/{cause['id']}/promote")
    assert first.status_code == 201
    second = client.post(f"/api/fishbone-causes/{cause['id']}/promote")
    assert second.status_code == 400


def test_cannot_delete_a_promoted_cause(client):
    incident_id = _new_incident(client)
    cause = client.post(f"/api/incidents/{incident_id}/fishbone-causes", json={
        "category": "measurement", "description": "Gauge R&R never performed for this feature",
    }).get_json()
    client.post(f"/api/fishbone-causes/{cause['id']}/promote")

    res = client.delete(f"/api/fishbone-causes/{cause['id']}")
    assert res.status_code == 400


def test_can_delete_an_unpromoted_cause(client):
    incident_id = _new_incident(client)
    cause = client.post(f"/api/incidents/{incident_id}/fishbone-causes", json={
        "category": "environment", "description": "Humidity spiked in the layup room that week",
    }).get_json()

    res = client.delete(f"/api/fishbone-causes/{cause['id']}")
    assert res.status_code == 204
