from datetime import date as date_cls

from flask import Blueprint, jsonify, request

import depot_client
import journal
from db import db
from models import (
    EVIDENCE_KINDS,
    MAX_CHAINS,
    ACTION_KINDS,
    ACTION_STATUSES,
    FISHBONE_CATEGORIES,
    INCIDENT_STATUSES,
    Action,
    FishboneCause,
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
    """Project names to file or filter cases under: every project with a case, plus every project
    Conway's Depot knows about (so a project's first case can be filed), when it's reachable."""
    rows = db.session.query(Incident.project).filter(Incident.project.isnot(None)).distinct().all()
    names = {r[0] for r in rows} | set(depot_client.fetch_project_names() or [])
    return jsonify(sorted(names))


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
    _milestone(incident, body, f'Opened a Fixer case: "{incident.title}".')
    return jsonify(incident.to_dict()), 201


def _milestone(incident: Incident, body: dict, text: str) -> None:
    """Post a case milestone to its project's Journal in the Depot, authored by whoever did it
    (`person_id` from the request). Written by code from the change itself, never by the AI."""
    depot_client.post_milestone(incident.project, body.get("person_id"), text)


def _close_gaps(incident: Incident) -> list[str]:
    """What's missing before a case can close cleanly."""
    gaps = []
    chains = incident.chains()
    if not chains:
        gaps.append("no 5-Whys chain")
    elif not all(c["root_step_id"] for c in chains):
        gaps.append("a chain without a root cause")
    linked = {a.why_step_id for a in incident.actions if a.kind in ("corrective", "preventive")}
    unanswered = [c for c in chains if c["root_step_id"] and c["root_step_id"] not in linked]
    if unanswered:
        gaps.append(f"{len(unanswered)} root cause{'s' if len(unanswered) != 1 else ''} with no corrective or preventive action")
    unverified = [a for a in incident.actions if a.status != "verified"]
    if unverified:
        gaps.append(f"{len(unverified)} action{'s' if len(unverified) != 1 else ''} not verified")
    return gaps


@bp.get("/incidents/<incident_id>")
def get_incident(incident_id):
    incident = Incident.query.get_or_404(incident_id)
    return jsonify(incident.to_dict(include_children=True))


@bp.put("/incidents/<incident_id>")
def update_incident(incident_id):
    incident = Incident.query.get_or_404(incident_id)
    body = request.get_json(force=True) or {}

    closing = False
    if "status" in body:
        if body["status"] not in INCIDENT_STATUSES:
            return jsonify({"error": f"status must be one of {INCIDENT_STATUSES}"}), 400
        closing = body["status"] == "closed" and incident.status != "closed"
        if closing:
            # Closing asks for a root cause on every chain and every action verified, or a
            # stated reason for closing anyway.
            gaps = _close_gaps(incident)
            reason = (body.get("override_reason") or "").strip()
            if gaps and not reason:
                return jsonify({"error": "can't close yet: " + "; ".join(gaps), "gaps": gaps}), 409
            incident.close_override_reason = reason if gaps else None
        incident.status = body["status"]
        incident.closed_at = _now() if body["status"] == "closed" else None

    for field in ("title", "description", "project", "portfolio", "reported_by"):
        if field in body:
            setattr(incident, field, body[field])

    db.session.commit()
    if closing:
        roots = [w.answer for w in incident.why_steps if w.is_root_cause and w.answer]
        _milestone(incident, body, f'Closed Fixer case "{incident.title}".'
                   + (f" Root cause: {'; '.join(roots)}." if roots else "")
                   + (f" Closed with open items: {incident.close_override_reason}" if incident.close_override_reason else ""))
    return jsonify(incident.to_dict())


@bp.delete("/incidents/<incident_id>")
def delete_incident(incident_id):
    incident = Incident.query.get_or_404(incident_id)
    db.session.delete(incident)
    db.session.commit()
    return "", 204


# ── Fishbone (predecessor to the Why chain — see models.py) ───────────────────────────────────

@bp.post("/incidents/<incident_id>/fishbone-causes")
def add_fishbone_cause(incident_id):
    Incident.query.get_or_404(incident_id)
    body = request.get_json(force=True) or {}

    category = body.get("category")
    if category not in FISHBONE_CATEGORIES:
        return jsonify({"error": f"category must be one of {FISHBONE_CATEGORIES}"}), 400
    description = (body.get("description") or "").strip()
    if not description:
        return jsonify({"error": "description is required"}), 400

    cause = FishboneCause(
        incident_id=incident_id,
        category=category,
        description=description,
        created_by=(body.get("created_by") or "").strip() or None,
    )
    db.session.add(cause)
    db.session.commit()
    return jsonify(cause.to_dict()), 201


@bp.delete("/fishbone-causes/<cause_id>")
def delete_fishbone_cause(cause_id):
    cause = FishboneCause.query.get_or_404(cause_id)
    if cause.promoted_why_step_id:
        return jsonify({"error": "this cause already started the Why chain — delete it there instead"}), 400
    db.session.delete(cause)
    db.session.commit()
    return "", 204


@bp.post("/fishbone-causes/<cause_id>/promote")
def promote_fishbone_cause(cause_id):
    """Starts a 5-Whys chain from this candidate cause: its first step is the cause itself, and
    each why after that digs one level deeper. A case can chase up to MAX_CHAINS causes at
    once, each on its own chain with its own root cause. See models.py's module docstring."""
    cause = FishboneCause.query.get_or_404(cause_id)
    if cause.promoted_why_step_id:
        return jsonify({"error": "this cause has already been promoted"}), 400
    incident = cause.incident
    promoted = sum(1 for c in incident.fishbone_causes if c.promoted_why_step_id)
    if promoted >= MAX_CHAINS:
        return jsonify({"error": f"a case can chase at most {MAX_CHAINS} causes at once"}), 400

    body = request.get_json(force=True, silent=True) or {}
    step = WhyStep(
        incident_id=incident.id,
        sequence=1,
        question="What could have caused this?",
        answer=cause.description,
        created_by=(body.get("created_by") or "").strip() or cause.created_by,
        cause_id=cause.id,
        evidence_kind="hypothesis",
    )
    db.session.add(step)
    db.session.flush()
    cause.promoted_why_step_id = step.id
    db.session.commit()
    return jsonify({"cause": cause.to_dict(), "why_step": step.to_dict()}), 201


# ── 5 Whys ───────────────────────────────────────────────────────────────────────────────────

@bp.post("/incidents/<incident_id>/why-steps")
def add_why_step(incident_id):
    """Appends the next link in the chain — sequence is always "one more than whatever's
    already there," so the frontend never has to compute or send it."""
    incident = Incident.query.get_or_404(incident_id)
    body = request.get_json(force=True) or {}

    cause_id = body.get("cause_id") or None  # which chain; none means the direct chain
    if cause_id and not any(c.id == cause_id for c in incident.fishbone_causes):
        return jsonify({"error": "cause_id isn't one of this case's causes"}), 400
    chain = [w for w in incident.why_steps if w.cause_id == cause_id]
    next_seq = (max((w.sequence for w in chain), default=0)) + 1
    step = WhyStep(
        incident_id=incident_id,
        sequence=next_seq,
        question=(body.get("question") or "Why did that happen?").strip() or "Why did that happen?",
        answer=(body.get("answer") or "").strip() or None,
        created_by=(body.get("created_by") or "").strip() or None,
        cause_id=cause_id,
        evidence=(body.get("evidence") or "").strip() or None,
        evidence_kind=body.get("evidence_kind") if body.get("evidence_kind") in EVIDENCE_KINDS else None,
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
    if "evidence" in body:
        step.evidence = (body["evidence"] or "").strip() or None
    if "evidence_kind" in body:
        if body["evidence_kind"] not in (*EVIDENCE_KINDS, None):
            return jsonify({"error": f"evidence_kind must be one of {EVIDENCE_KINDS}"}), 400
        step.evidence_kind = body["evidence_kind"]
    if "root_checks" in body:
        step.root_checks = body["root_checks"]
    marking_root = False
    if "is_root_cause" in body:
        want = bool(body["is_root_cause"])
        if want and not step.is_root_cause:
            # The root-cause test: something the org controls, that would have prevented this,
            # and that the evidence backs up. All three, or it's another symptom.
            checks = step.root_checks or {}
            missing = [k for k in ("controllable", "prevents_recurrence", "evidenced") if not checks.get(k)]
            if missing:
                return jsonify({"error": "answer the root-cause test first", "missing": missing}), 400
            # One root cause per chain.
            for other in step.incident.why_steps:
                if other.cause_id == step.cause_id and other.id != step.id:
                    other.is_root_cause = False
            marking_root = True
        step.is_root_cause = want

    after = {f: getattr(step, f) for f in journal.WHY_STEP_FIELDS}
    journal.record_changes(
        step.incident_id, "why_step", step.id, f"Why {step.sequence}", before, after,
        journal.WHY_STEP_FIELDS, author=body.get("author"), note=body.get("journal_note"),
    )

    db.session.commit()
    if marking_root:
        _milestone(step.incident, body, f'Root cause found on Fixer case "{step.incident.title}": {step.answer}')
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

    why_step_id = body.get("why_step_id") or None
    if why_step_id and not WhyStep.query.filter_by(id=why_step_id, incident_id=incident_id).first():
        return jsonify({"error": "why_step_id isn't a step on this case"}), 400
    action = Action(
        incident_id=incident_id,
        kind=kind,
        description=description,
        owner=(body.get("owner") or "").strip() or None,
        due_date=_date(body.get("due_date")),
        why_step_id=why_step_id,
        verification_method=(body.get("verification_method") or "").strip() or None,
        effectiveness_check_date=_date(body.get("effectiveness_check_date")),
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
        verifying = body["status"] == "verified" and action.status != "verified"
        action.status = body["status"]
        if body["status"] == "verified":
            verified_by = (body.get("verified_by") or "").strip()
            evidence = (body.get("verification_evidence") or action.verification_evidence or "").strip()
            if not verified_by:
                return jsonify({"error": "verified_by is required to verify an action"}), 400
            if not evidence:
                return jsonify({"error": "say what showed it worked (verification_evidence) to verify it"}), 400
            action.verified_by = verified_by
            action.verification_evidence = evidence
            action.verified_at = _now()
        else:
            action.verified_by = None
            action.verified_at = None
    else:
        verifying = False

    for field in ("description", "owner", "verification_method"):
        if field in body:
            setattr(action, field, (body[field] or "").strip() or None)
    for field in ("due_date", "effectiveness_check_date"):
        if field in body:
            setattr(action, field, _date(body[field]))
    if "why_step_id" in body:
        action.why_step_id = body["why_step_id"] or None

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
    if verifying:
        _milestone(action.incident, body, f'{action.kind.capitalize()} action verified on Fixer case "{action.incident.title}": '
                   f'{action.description} Evidence: {action.verification_evidence}')
    return jsonify(action.to_dict())


def _date(value):
    """An ISO date string, a date, or blank -> a date or None."""
    if not value:
        return None
    if isinstance(value, date_cls):
        return value
    return date_cls.fromisoformat(str(value)[:10])


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
