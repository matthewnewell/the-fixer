from flask import Blueprint, jsonify, request

import journal
from db import db
from models import (
    ACTION_KINDS,
    ACTION_STATUSES,
    INCIDENT_STATUSES,
    Action,
    Incident,
    IncidentEvent,
    WhyStep,
    _now,
)

bp = Blueprint("incidents", __name__, url_prefix="/api")


@bp.get("/incidents")
def list_incidents():
    q = Incident.query
    if project := request.args.get("project"):
        q = q.filter(Incident.project == project)
    if status := request.args.get("status"):
        q = q.filter(Incident.status == status)
    incidents = q.order_by(Incident.created_at.desc()).all()
    return jsonify([i.to_dict() for i in incidents])


@bp.get("/projects")
def list_projects():
    rows = db.session.query(Incident.project).filter(Incident.project.isnot(None)).distinct().all()
    return jsonify(sorted({r[0] for r in rows}))


@bp.post("/incidents")
def create_incident():
    body = request.get_json(force=True) or {}
    title = (body.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    incident = Incident(
        title=title,
        description=(body.get("description") or "").strip() or None,
        project=(body.get("project") or "").strip() or None,
        portfolio=(body.get("portfolio") or "").strip() or None,
        reported_by=(body.get("reported_by") or "").strip() or None,
    )
    db.session.add(incident)
    db.session.commit()
    return jsonify(incident.to_dict()), 201


@bp.get("/incidents/<incident_id>")
def get_incident(incident_id):
    incident = Incident.query.get_or_404(incident_id)
    return jsonify(incident.to_dict(include_children=True))


@bp.put("/incidents/<incident_id>")
def update_incident(incident_id):
    incident = Incident.query.get_or_404(incident_id)
    body = request.get_json(force=True) or {}

    if "status" in body:
        if body["status"] not in INCIDENT_STATUSES:
            return jsonify({"error": f"status must be one of {INCIDENT_STATUSES}"}), 400
        incident.status = body["status"]
        incident.closed_at = _now() if body["status"] == "closed" else None

    for field in ("title", "description", "project", "portfolio", "reported_by"):
        if field in body:
            setattr(incident, field, body[field])

    db.session.commit()
    return jsonify(incident.to_dict())


@bp.delete("/incidents/<incident_id>")
def delete_incident(incident_id):
    incident = Incident.query.get_or_404(incident_id)
    db.session.delete(incident)
    db.session.commit()
    return "", 204


# ── 5 Whys ───────────────────────────────────────────────────────────────────────────────────

@bp.post("/incidents/<incident_id>/why-steps")
def add_why_step(incident_id):
    """Appends the next link in the chain — sequence is always "one more than whatever's
    already there," so the frontend never has to compute or send it."""
    incident = Incident.query.get_or_404(incident_id)
    body = request.get_json(force=True) or {}

    next_seq = (max((w.sequence for w in incident.why_steps), default=0)) + 1
    step = WhyStep(
        incident_id=incident_id,
        sequence=next_seq,
        question=(body.get("question") or "Why?").strip() or "Why?",
        answer=(body.get("answer") or "").strip() or None,
        created_by=(body.get("created_by") or "").strip() or None,
    )
    db.session.add(step)
    db.session.commit()
    return jsonify(step.to_dict()), 201


@bp.put("/why-steps/<step_id>")
def update_why_step(step_id):
    step = WhyStep.query.get_or_404(step_id)
    body = request.get_json(force=True) or {}

    before = {f: getattr(step, f) for f in journal.WHY_STEP_FIELDS}

    if "answer" in body:
        step.answer = (body["answer"] or "").strip() or None
    if "question" in body:
        step.question = (body["question"] or "Why?").strip() or "Why?"
    if "is_root_cause" in body:
        step.is_root_cause = bool(body["is_root_cause"])

    after = {f: getattr(step, f) for f in journal.WHY_STEP_FIELDS}
    journal.record_changes(
        step.incident_id, "why_step", step.id, f"Why {step.sequence}", before, after,
        journal.WHY_STEP_FIELDS, author=body.get("author"), note=body.get("journal_note"),
    )

    db.session.commit()
    return jsonify(step.to_dict())


@bp.delete("/why-steps/<step_id>")
def delete_why_step(step_id):
    step = WhyStep.query.get_or_404(step_id)
    db.session.delete(step)
    db.session.commit()
    return "", 204


# ── Corrective / Preventive Actions ─────────────────────────────────────────────────────────

@bp.post("/incidents/<incident_id>/actions")
def create_action(incident_id):
    Incident.query.get_or_404(incident_id)
    body = request.get_json(force=True) or {}

    kind = body.get("kind")
    if kind not in ACTION_KINDS:
        return jsonify({"error": f"kind must be one of {ACTION_KINDS}"}), 400
    description = (body.get("description") or "").strip()
    if not description:
        return jsonify({"error": "description is required"}), 400

    action = Action(
        incident_id=incident_id,
        kind=kind,
        description=description,
        owner=(body.get("owner") or "").strip() or None,
        due_date=body.get("due_date") or None,
    )
    db.session.add(action)
    db.session.commit()
    return jsonify(action.to_dict()), 201


def _action_target_name(action: Action) -> str:
    desc = (action.description or "").strip()
    if len(desc) > 50:
        desc = desc[:47] + "…"
    return f"{action.kind.capitalize()}: {desc}" if desc else action.kind.capitalize()


@bp.put("/actions/<action_id>")
def update_action(action_id):
    action = Action.query.get_or_404(action_id)
    body = request.get_json(force=True) or {}

    before = {f: getattr(action, f) for f in journal.ACTION_FIELDS}

    if "status" in body:
        if body["status"] not in ACTION_STATUSES:
            return jsonify({"error": f"status must be one of {ACTION_STATUSES}"}), 400
        action.status = body["status"]
        if body["status"] == "verified":
            verified_by = (body.get("verified_by") or "").strip()
            if not verified_by:
                return jsonify({"error": "verified_by is required to verify an action"}), 400
            action.verified_by = verified_by
            action.verified_at = _now()
        else:
            action.verified_by = None
            action.verified_at = None

    for field in ("description", "owner", "due_date"):
        if field in body:
            setattr(action, field, body[field])

    after = {f: getattr(action, f) for f in journal.ACTION_FIELDS}
    # verified_by doubles as the author when the change in question IS the verification — the
    # one place in this UI a name already gets typed; every other edit stays anonymous unless a
    # journal note is added with one, same as Value Stream's own convention.
    author = body.get("author") or (action.verified_by if body.get("status") == "verified" else None)
    journal.record_changes(
        action.incident_id, "action", action.id, _action_target_name(action), before, after,
        journal.ACTION_FIELDS, author=author, note=body.get("journal_note"),
    )

    db.session.commit()
    return jsonify(action.to_dict())


@bp.delete("/actions/<action_id>")
def delete_action(action_id):
    action = Action.query.get_or_404(action_id)
    db.session.delete(action)
    db.session.commit()
    return "", 204


# ── Journal ──────────────────────────────────────────────────────────────────────────────────

@bp.get("/incidents/<incident_id>/events")
def list_events(incident_id):
    """The case's journal, newest first. `?target_id=<id>` scopes it to one why-step/action
    (a per-item view); omit it for the whole-case feed."""
    Incident.query.get_or_404(incident_id)
    q = IncidentEvent.query.filter_by(incident_id=incident_id)
    if target_id := request.args.get("target_id"):
        q = q.filter_by(target_id=target_id)
    # Newest group first; within a group (one save) the mechanical changes, then the note.
    events = q.order_by(IncidentEvent.created_at.desc(), IncidentEvent.kind.asc(), IncidentEvent.id.asc()).all()
    return jsonify([e.to_dict() for e in events])


@bp.post("/incidents/<incident_id>/events")
def add_event(incident_id):
    """Add a manual note - the evidence a CAPA action was actually performed. Body: {note,
    author?, target_type?, target_id?, target_name?}. Auto-captured 'change' events are written
    by the why-step/action PUT routes, not here."""
    Incident.query.get_or_404(incident_id)
    body = request.get_json(force=True) or {}
    note = (body.get("note") or "").strip()
    if not note:
        return jsonify({"error": "note is required"}), 400

    ev = IncidentEvent(
        incident_id=incident_id,
        kind="note",
        note=note,
        author=(body.get("author") or "").strip() or None,
        target_type=body.get("target_type") or "incident",
        target_id=body.get("target_id"),
        target_name=body.get("target_name"),
    )
    db.session.add(ev)
    db.session.commit()
    return jsonify(ev.to_dict()), 201


@bp.delete("/events/<event_id>")
def delete_event(event_id):
    """Remove a manual note (a typo, a wrong call). 'change' history is permanent."""
    ev = IncidentEvent.query.get_or_404(event_id)
    if ev.kind != "note":
        return jsonify({"error": "only manual notes can be deleted; change history is permanent"}), 400
    db.session.delete(ev)
    db.session.commit()
    return "", 204
