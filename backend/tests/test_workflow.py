"""The guided workflow's rules: evidence and the root-cause test on why-steps, actions linked to
root causes with verification evidence, the close gate, stage progress, and Journal milestones."""

import os
import shutil
import sys

os.environ["DATA_DIR"] = os.path.join(os.path.dirname(__file__), "_tmp_workflow_data")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from app import create_app
from db import db

CHECKS = {"controllable": True, "prevents_recurrence": True, "evidenced": True}


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


def _case(client, **extra):
    return client.post("/api/incidents", json={"title": "Voids at NDI", **extra}).get_json()["id"]


def _stage(client, iid):
    return client.get(f"/api/incidents/{iid}").get_json()["stage"]


def test_root_cause_needs_the_test_answered(client):
    iid = _case(client, description="Three voids on S/N 004.")
    step = client.post(f"/api/incidents/{iid}/why-steps", json={"answer": "Cure cycle ran short"}).get_json()
    assert client.put(f"/api/why-steps/{step['id']}", json={"is_root_cause": True}).status_code == 400
    client.put(f"/api/why-steps/{step['id']}", json={"root_checks": CHECKS, "evidence": "Oven log", "evidence_kind": "fact"})
    res = client.put(f"/api/why-steps/{step['id']}", json={"is_root_cause": True})
    assert res.status_code == 200 and res.get_json()["is_root_cause"]


def test_stages_advance_and_close_gate(client, no_live_depot):
    iid = _case(client, project="Nacelle Fairing Retrofit", person_id="p1")
    assert _stage(client, iid) == "describe"
    client.put(f"/api/incidents/{iid}", json={"description": "Three voids on S/N 004."})
    assert _stage(client, iid) == "brainstorm"
    step = client.post(f"/api/incidents/{iid}/why-steps", json={"answer": "Cure cycle ran short"}).get_json()
    assert _stage(client, iid) == "whys"
    client.put(f"/api/why-steps/{step['id']}", json={"root_checks": CHECKS})
    client.put(f"/api/why-steps/{step['id']}", json={"is_root_cause": True, "person_id": "p1"})
    assert _stage(client, iid) == "actions"

    # closing now is blocked without a reason
    res = client.put(f"/api/incidents/{iid}", json={"status": "closed"})
    assert res.status_code == 409

    action = client.post(f"/api/incidents/{iid}/actions", json={
        "kind": "preventive", "description": "Add thermocouple interlock", "why_step_id": step["id"],
        "verification_method": "Next 5 cures log full dwell", "effectiveness_check_date": "2026-12-01",
    }).get_json()
    assert action["why_step_id"] == step["id"]
    assert _stage(client, iid) == "verify"

    # verifying needs evidence
    assert client.put(f"/api/actions/{action['id']}", json={"status": "verified", "verified_by": "Jordan"}).status_code == 400
    ok = client.put(f"/api/actions/{action['id']}", json={
        "status": "verified", "verified_by": "Jordan", "verification_evidence": "Cures 5-9 logged full dwell"})
    assert ok.status_code == 200
    assert client.put(f"/api/incidents/{iid}", json={"status": "closed", "person_id": "p1"}).status_code == 200
    assert _stage(client, iid) == "closed"

    texts = [body for _, _, body in no_live_depot]
    assert any(t.startswith("Opened a Fixer case") for t in texts)
    assert any("Root cause found" in t for t in texts)
    assert any("action verified" in t for t in texts)
    assert any(t.startswith("Closed Fixer case") for t in texts)


def test_close_with_override_reason(client):
    iid = _case(client)
    res = client.put(f"/api/incidents/{iid}", json={"status": "closed", "override_reason": "Duplicate of another case"})
    assert res.status_code == 200
    assert res.get_json()["close_override_reason"] == "Duplicate of another case"


def test_containment_is_an_action_kind(client):
    iid = _case(client)
    res = client.post(f"/api/incidents/{iid}/actions", json={"kind": "containment", "description": "Quarantine S/N 003-006"})
    assert res.status_code == 201


def test_guide_drops_cards_that_dont_fit_the_case(client, monkeypatch):
    import ai_client
    iid = _case(client)
    step = client.post(f"/api/incidents/{iid}/why-steps", json={"answer": "Cure cycle ran short"}).get_json()
    monkeypatch.setattr(ai_client, "is_configured", lambda: True)
    monkeypatch.setattr(ai_client, "chat_json", lambda *a, **k: {"reply": "Try these.", "suggestions": [
        {"type": "action", "kind": "preventive", "description": "Oven interlock", "why_step_id": step["id"]},
        {"type": "action", "kind": "preventive", "description": "Bad step ref", "why_step_id": "nope"},
        {"type": "action", "kind": "wishful", "description": "Not a kind"},
        {"type": "cause", "category": "man", "description": "Wrong step's card type"},
    ]})
    d = client.post(f"/api/incidents/{iid}/guide", json={"step": "actions", "messages": []}).get_json()
    assert d["reply"] == "Try these."
    assert [c["description"] for c in d["suggestions"]] == ["Oven interlock", "Bad step ref"]
    assert d["suggestions"][1]["why_step_id"] is None
