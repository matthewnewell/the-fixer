"""
Demo seed — two incidents, one fully worked (closed, root cause found, both a corrective and a
preventive action, both carrying a journal evidence note), one still in progress (no root cause
yet). Both projects match the demo projects Value Stream, Conway's Depot, and
Dude-Where's-My-Part already share, and the first incident is the exact scenario the user
described when %C&A/rework was designed into Value Stream: a design defect that escapes to
Build and forces a re-buy of a long-lead casting.

The in-progress incident's Why chain is backed by a fishbone brainstorm — three candidate
causes considered (Man/Machine/Method), one promoted, so a fresh case shows the whole predecessor
step already worked through, not just its aftermath.
"""

from datetime import timedelta

from db import db
from models import Action, FishboneCause, Incident, IncidentEvent, WhyStep, _now

DAY = timedelta(days=1)
_BKT = "Bracket Assembly Project"
_NAC = "Nacelle Fairing Retrofit"
_PORTFOLIO = "Industrial Programs"  # same demo portfolio DWMP's assemblies sit under

# Fixed (not random-uuid) id for the fully-worked demo case, so the splash page's demo link
# (and anything else that wants a stable "show me a real one" link, same as Value Stream's
# /sample) can point straight at it without looking anything up first.
DEMO_CASE_ID = "demo-casting-rework"


def seed_if_empty():
    if Incident.query.count() > 0:
        return

    # ── Incident 1: closed, root cause found, both action types ──
    casting = Incident(
        id=DEMO_CASE_ID,
        title="Long-lead casting re-ordered after CDR — design defect escaped to Build",
        description=(
            "A design defect in the bracket wasn't caught until Build, forcing a re-buy of the "
            "long-lead casting and about a three-week schedule slip."
        ),
        project=_BKT,
        portfolio=_PORTFOLIO,
        reported_by="Sam Ortiz (PM)",
        status="closed",
        created_at=_now() - 30 * DAY,
        closed_at=_now() - 2 * DAY,
    )
    db.session.add(casting)
    db.session.flush()

    # Fishbone brainstorm — done before the Why chain, same as the NDT case below: candidates
    # considered across three categories, one promoted, its description becoming the first
    # why's answer. This is the demo case the splash page and "Demo" nav link point at, so it's
    # the one that most needs a fishbone history behind it.
    casting_fishbone = [
        ("material", "The casting didn't match the as-built mounting hole pattern discovered during Build.", True),
        ("method", "Long-lead procurement is gated on Architecture Definition, not the released drawing, so it locks in before the design is final.", False),
        ("man", "No one owns reconciling a design change against already-open long-lead purchase orders.", False),
    ]
    casting_promoted_cause = None
    casting_promoted_description = None
    for category, description, promoted in casting_fishbone:
        cause = FishboneCause(
            incident_id=casting.id, category=category, description=description,
            created_by="Sam Ortiz (PM)", created_at=casting.created_at + timedelta(hours=1),
        )
        db.session.add(cause)
        db.session.flush()
        if promoted:
            casting_promoted_cause = cause
            casting_promoted_description = description

    casting_whys = [
        ("Why did the long-lead casting have to be re-ordered?",
         casting_promoted_description, False),
        ("Why didn't it match?",
         "Design Definition changed the hole pattern after the long-lead casting was already on order.", False),
        ("Why was the casting ordered before the design was final?",
         "Long-lead procurement is gated on Architecture Definition, not the released drawing, to protect schedule.", False),
        ("Why wasn't the change checked against the open long-lead order before the casting was poured?",
         "There's no formal check that re-verifies open long-lead commitments when a design change is made after PDR.", False),
        ("Why is there no such check?",
         "Design change review doesn't include a step to cross-check open long-lead procurement commitments.", True),
    ]
    casting_first_step = None
    for i, (q, a, root) in enumerate(casting_whys, start=1):
        step = WhyStep(
            incident_id=casting.id, sequence=i, question=q, answer=a, is_root_cause=root,
            created_by="Sam Ortiz (PM)", created_at=casting.created_at + i * DAY,
        )
        db.session.add(step)
        db.session.flush()
        if i == 1:
            casting_first_step = step
    casting_promoted_cause.promoted_why_step_id = casting_first_step.id

    corrective = Action(
        incident_id=casting.id, kind="corrective",
        description="Re-order the casting to the corrected hole pattern and expedite.",
        owner="Subcontracts", status="done",
        created_at=casting.created_at + 5 * DAY,
    )
    preventive = Action(
        incident_id=casting.id, kind="preventive",
        description=(
            "Add a long-lead-impact check to the design change review checklist — any "
            "change after PDR must be checked against open long-lead POs before it's approved."
        ),
        owner="Systems Engineering", status="open", due_date=(_now() + 14 * DAY).date(),
        created_at=casting.created_at + 6 * DAY,
    )
    db.session.add_all([corrective, preventive])
    db.session.flush()

    # Journal: the evidence, not just the status flip - the actual point of the feature.
    db.session.add_all([
        IncidentEvent(
            incident_id=casting.id, created_at=casting.created_at + 6 * DAY,
            target_type="action", target_id=corrective.id,
            target_name=f"Corrective: {corrective.description[:50]}",
            author="Sam Ortiz (PM)", kind="note",
            note="Re-order PO #4471 placed with the corrected hole pattern, expedited with Subcontracts — confirmed new ship date 3 weeks out.",
        ),
        IncidentEvent(
            incident_id=casting.id, created_at=casting.created_at + 7 * DAY,
            target_type="action", target_id=preventive.id,
            target_name=f"Preventive: {preventive.description[:50]}",
            author="Sam Ortiz (PM)", kind="note",
            note="Drafted the checklist addition and sent to Systems Engineering for review before it goes into the design change procedure.",
        ),
    ])

    # ── Incident 2: still being worked, no root cause yet ──
    ndt = Incident(
        title="Recurring NDT hold on fairing panels",
        description="Fairing panels keep sitting in an NDT hold waiting on inspector availability.",
        project=_NAC,
        portfolio=_PORTFOLIO,
        reported_by="Dana Kim (PM)",
        status="investigating",
        created_at=_now() - 2 * DAY,
    )
    db.session.add(ndt)
    db.session.flush()

    # Fishbone brainstorm — done before the Why chain, per the module docstring: three
    # candidates considered, one promoted (its description became the first why's answer).
    ndt_fishbone = [
        ("man", "Only one certified NDT inspector for this panel type on this shift.", True),
        ("machine", "NDT booth is only calibrated for one panel geometry, so it can't flex to cover the gap.", False),
        ("method", "No cross-training plan gets a backup inspector certified before the current one is out.", False),
    ]
    promoted_description = None
    for category, description, promoted in ndt_fishbone:
        cause = FishboneCause(
            incident_id=ndt.id, category=category, description=description,
            created_by="Dana Kim (PM)", created_at=ndt.created_at + timedelta(hours=1),
        )
        db.session.add(cause)
        db.session.flush()
        if promoted:
            promoted_cause = cause
            promoted_description = description

    ndt_whys = [
        ("Why are panels sitting in an NDT hold?", promoted_description, False),
        ("Why is there only one certified inspector?",
         "Certification training wasn't scheduled for backup inspectors this quarter.", False),
    ]
    first_step = None
    for i, (q, a, root) in enumerate(ndt_whys, start=1):
        step = WhyStep(
            incident_id=ndt.id, sequence=i, question=q, answer=a, is_root_cause=root,
            created_by="Dana Kim (PM)", created_at=ndt.created_at + i * timedelta(hours=6),
        )
        db.session.add(step)
        db.session.flush()
        if i == 1:
            first_step = step
    promoted_cause.promoted_why_step_id = first_step.id

    db.session.commit()


_RAD = "Radar Housing Production"
_DEF_PORTFOLIO = "Defense Systems"

# (title, description, project, portfolio, reported_by, status, days ago)
_EXTRA_CASES = [
    (
        "Fairing lay-up voids found at NDI",
        "Two consecutive fairing panels showed voids at NDI after autoclave cure. Routed here from Mission Assurance.",
        _NAC, _PORTFOLIO, "Priya Nair (Mission Assurance)", "open", 8,
    ),
    (
        "Titanium forging arrival slipped two weeks",
        "The forging supplier moved the promise date twice; machining had to be re-sequenced to absorb it.",
        _RAD, _DEF_PORTFOLIO, "Alex Chen (Engineering)", "investigating", 10,
    ),
]


def seed_extra_cases():
    """Cases for the demo projects beyond the two original ones, so a project's tile in Conway's
    Depot has something to show. Idempotent (skips a title that already exists)."""
    for title, description, project, portfolio, reported_by, status, days_ago in _EXTRA_CASES:
        if Incident.query.filter_by(title=title).first():
            continue
        db.session.add(Incident(
            title=title, description=description, project=project, portfolio=portfolio,
            reported_by=reported_by, status=status, created_at=_now() - days_ago * DAY,
        ))
    db.session.commit()
