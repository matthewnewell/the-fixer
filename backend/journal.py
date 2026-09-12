"""Journal capture — turns a why-step/action edit into append-only IncidentEvent rows.

Ported from Value Stream's journal.py: same shape, same reasoning. The set of fields worth
logging is deliberately narrow — the things that matter to someone reading the case back later,
not bookkeeping. Values are frozen as short display strings at capture time.
"""

from datetime import datetime, timezone

from db import db
from models import IncidentEvent

# field name -> label shown in the feed
WHY_STEP_FIELDS = {
    "question": "question",
    "answer": "answer",
    "is_root_cause": "root cause",
}

ACTION_FIELDS = {
    "description": "description",
    "owner": "owner",
    "due_date": "due date",
    "status": "status",
    "verified_by": "verified by",
}


def _fmt(field: str, value) -> str:
    if value is None or value == "":
        return "—"
    if isinstance(value, bool):
        return "yes" if value else "no"
    return str(value)


def record_changes(
    incident_id: str,
    target_type: str,
    target_id: str,
    target_name: str,
    before: dict,
    after: dict,
    fields: dict,
    *,
    author: str | None = None,
    note: str | None = None,
) -> bool:
    """Append one 'change' event per field in `fields` that actually changed, plus one 'note'
    event if `note` was supplied. All events from one save share an exact timestamp so the feed
    can group them. Returns whether anything changed. Caller commits."""
    author = (author or "").strip() or None
    ts = datetime.now(timezone.utc)
    changed = False
    for field, label in fields.items():
        old, new = before.get(field), after.get(field)
        if old == new:
            continue
        changed = True
        db.session.add(
            IncidentEvent(
                incident_id=incident_id,
                created_at=ts,
                target_type=target_type,
                target_id=target_id,
                target_name=target_name,
                author=author,
                kind="change",
                field=label,
                old_value=_fmt(field, old),
                new_value=_fmt(field, new),
            )
        )
    if note and note.strip():
        db.session.add(
            IncidentEvent(
                incident_id=incident_id,
                created_at=ts,
                target_type=target_type,
                target_id=target_id,
                target_name=target_name,
                author=author,
                kind="note",
                note=note.strip(),
            )
        )
    return changed
