"""
Models: Incident, WhyStep, Action.

An Incident is what failed. A WhyStep is one link in a 5-Whys chain worked against it — a
linear sequence (why 1 -> why 2 -> ... -> root cause), the same shape as a Value Stream node
chain: each step points at the one before it, and the chain terminates when someone marks a
step the actual root cause rather than just another symptom one level down. Fishbone (the
categorical Man/Machine/Method/Material/Measurement/Environment view) is deliberately not
built yet — 5 Whys covers the common case and reuses a much simpler linear-chain data shape;
fishbone is a real second canvas type, not a variant of this one.

An Action is a Corrective or Preventive Action (CAPA) against the incident — fixing what broke
this time (corrective) vs. changing something so it can't happen again (preventive). Both live
on the same list because in practice a real CAPA record almost always has one of each.
"""

from datetime import datetime, timezone

from db import _uuid, db


def _now():
    return datetime.now(timezone.utc)


INCIDENT_STATUSES = ("open", "investigating", "closed")
ACTION_KINDS = ("corrective", "preventive")
ACTION_STATUSES = ("open", "in_progress", "done", "verified")


class Incident(db.Model):
    """What failed. `project`/`portfolio` are plain-text labels — same cross-app-by-convention
    pattern as everywhere else in this ecosystem (matches DWMP's Assembly: a portfolio owns
    projects, a project owns the thing that failed)."""

    __tablename__ = "incident"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    project = db.Column(db.String(200), nullable=True, index=True)
    portfolio = db.Column(db.String(200), nullable=True, index=True)
    reported_by = db.Column(db.String(120), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="open")  # see INCIDENT_STATUSES
    created_at = db.Column(db.DateTime, default=_now, nullable=False)
    closed_at = db.Column(db.DateTime, nullable=True)

    why_steps = db.relationship(
        "WhyStep", backref="incident", cascade="all, delete-orphan", lazy="selectin",
        order_by="WhyStep.sequence",
    )
    actions = db.relationship(
        "Action", backref="incident", cascade="all, delete-orphan", lazy="selectin",
        order_by="Action.created_at",
    )

    def to_dict(self, include_children: bool = False) -> dict:
        d = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "project": self.project,
            "portfolio": self.portfolio,
            "reported_by": self.reported_by,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "why_count": len(self.why_steps),
            "action_count": len(self.actions),
            "has_root_cause": any(w.is_root_cause for w in self.why_steps),
            "open_action_count": sum(1 for a in self.actions if a.status != "verified"),
        }
        if include_children:
            d["why_steps"] = [w.to_dict() for w in self.why_steps]
            d["actions"] = [a.to_dict() for a in self.actions]
        return d


class WhyStep(db.Model):
    """One link in the 5-Whys chain. `sequence` is 1-indexed and strictly ordered — the chain
    is a straight line, not a tree, on purpose (fishbone is the tool for "more than one cause
    at this level"; this one is for "keep asking why until you hit something you can act on")."""

    __tablename__ = "why_step"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    incident_id = db.Column(db.String(36), db.ForeignKey("incident.id"), nullable=False, index=True)
    sequence = db.Column(db.Integer, nullable=False)
    question = db.Column(db.String(300), nullable=False, default="Why?")
    answer = db.Column(db.Text, nullable=True)
    # Marks this step as the actual root cause, not just another symptom one level down — the
    # chain can keep growing past it (someone can un-mark and extend further), but the UI reads
    # this as "we can stop here" rather than a hard length limit.
    is_root_cause = db.Column(db.Boolean, default=False, nullable=False)
    created_by = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "incident_id": self.incident_id,
            "sequence": self.sequence,
            "question": self.question,
            "answer": self.answer,
            "is_root_cause": self.is_root_cause,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
        }


class Action(db.Model):
    """A Corrective or Preventive Action against the incident. `verified_at`/`verified_by`
    exist because a real CAPA record's last step is confirming the action actually worked —
    "done" and "verified" are deliberately different states."""

    __tablename__ = "action"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    incident_id = db.Column(db.String(36), db.ForeignKey("incident.id"), nullable=False, index=True)
    kind = db.Column(db.String(20), nullable=False)  # see ACTION_KINDS
    description = db.Column(db.Text, nullable=False)
    owner = db.Column(db.String(120), nullable=True)
    due_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="open")  # see ACTION_STATUSES
    verified_by = db.Column(db.String(120), nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "incident_id": self.incident_id,
            "kind": self.kind,
            "description": self.description,
            "owner": self.owner,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "status": self.status,
            "verified_by": self.verified_by,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "created_at": self.created_at.isoformat(),
        }
