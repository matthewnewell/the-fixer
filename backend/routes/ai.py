"""
Chat assist — same shape as Value Stream's and Conway's Depot's: stateless (the frontend owns
history, resending it each call), context rebuilt fresh from the database every time so an
edit mid-conversation shows up in the next reply without restarting the chat.

Deliberately a chat pane, not a per-field "AI Suggest" button on the Why chain — that pattern
was tried and pulled back out of Value Stream in favor of exactly this shape (one persistent,
context-aware assistant beats a suggest button scattered on every field).
"""

from flask import Blueprint, jsonify, request

import ai_client
from models import Incident

bp = Blueprint("ai", __name__, url_prefix="/api")

SYSTEM_PROMPT = """You are the assistant embedded in The Fixer, a root-cause-analysis and CAPA
(Corrective and Preventive Action) tool. A case moves through Describe -> Brainstorm (fishbone)
-> 5 Whys (one chain per chosen cause, up to three, each ending in its own root cause) -> Actions
(containment, corrective, preventive) -> Verify -> Closed.

Your job:
- If the Why chain is still empty, help with the fishbone brainstorm first: prompt across the
  six categories (Man, Machine, Method, Material, Measurement, Environment) and push back on a
  shallow one-word cause the same way you'd push back on a restated symptom — "training" isn't a
  candidate cause, "the backup inspectors' cert training wasn't scheduled this quarter" is. Not
  every category needs an entry; a category with nothing plausible is a real finding, not a gap
  to fill for its own sake. Once a couple of candidates look real, help pick which to chase
  (up to three); promoting a cause starts its own Why chain.
- Help ask the next "why" — a good next why digs into a *cause*, not a restated symptom. If the
  most recent answer just rephrases the problem ("it failed because it broke") rather than
  explaining a mechanism, say so plainly and suggest a sharper question.
- Notice when a chain has plausibly reached an actual root cause (something the org can act on
  — a missing check, a process gap, a design assumption) versus one that's stalled on "human
  error" or "bad luck," which are almost never real root causes on their own — push past those.
- When asked about actions, keep Containment (stop the bleeding now), Corrective (fixes this
  specific occurrence) and Preventive (stops the mechanism from recurring) distinct. Every root
  cause needs a corrective or preventive action that traces back to it, and every action needs a
  way to tell whether it worked.
- You can't change the case yourself. The "Guide me" panel on each step turns the conversation
  into suggestions the person adds with a click; point them there instead of claiming you did it.

Never invent facts about the incident that aren't in the context below. If the chain is empty
or thin, say so and help build it rather than guessing at what happened."""

_CATEGORY_LABEL = {
    "man": "Man", "machine": "Machine", "method": "Method",
    "material": "Material", "measurement": "Measurement", "environment": "Environment",
}


def _build_context(incident: Incident) -> str:
    lines = [f'Incident: "{incident.title}" (status: {incident.status})']
    if incident.project:
        lines.append(f"Project: {incident.project}")
    if incident.description:
        lines.append(f"Description: {incident.description}")

    lines.append("\nFishbone brainstorm so far:")
    if incident.fishbone_causes:
        for c in incident.fishbone_causes:
            promoted = "  <- promoted, started the Why chain" if c.promoted_why_step_id else ""
            lines.append(f"  [{_CATEGORY_LABEL.get(c.category, c.category)}] {c.description}{promoted}")
    else:
        lines.append("  (none yet)")

    lines.append("\n5 Whys chains so far (each chain id in brackets):")
    chains = incident.chains()
    if chains:
        for c in chains:
            head = f"from cause: {c['cause']['description']}" if c["cause"] else "started directly"
            lines.append(f"  Chain [{c['id']}] {head}")
            for w in c["steps"]:
                root = "  <- ROOT CAUSE" if w["is_root_cause"] else ""
                ev = f" (evidence, {w['evidence_kind'] or 'unrated'}: {w['evidence']})" if w["evidence"] else " (no evidence recorded)"
                lines.append(f"    step [{w['id']}] {w['sequence']}. {w['question']} -> {w['answer'] or '(not answered yet)'}{ev}{root}")
    else:
        lines.append("  (none yet)")

    lines.append("\nActions so far:")
    if incident.actions:
        for a in incident.actions:
            lines.append(
                f"  - [{a.kind}] {a.description} (owner: {a.owner or 'unassigned'}, status: {a.status}"
                + (f", answers step [{a.why_step_id}]" if a.why_step_id else "")
                + (f", verify by: {a.verification_method}" if a.verification_method else "")
                + ")"
            )
    else:
        lines.append("  (none yet)")

    return "\n".join(lines)


_LIST_PROMPT = """You are the assistant embedded in The Fixer, a root-cause-analysis and CAPA
tool, looking at a list of cases rather than one case. Help the person see patterns (the same
cause showing up across cases, actions overdue or never verified, cases stuck without a root
cause), decide which case needs attention first, and explain how the Fixer's workflow goes
(fishbone brainstorm, 5 Whys, corrective and preventive actions, verification). Ground every
answer in the cases below and never invent facts about them. You can't change any data: if asked
to, say where in the Fixer to do it."""


def _build_list_context(project: str | None) -> str:
    q = Incident.query.filter_by(project=project) if project else Incident.query
    cases = q.order_by(Incident.created_at.desc()).all()
    lines = [f"Cases for project {project}:" if project else "All cases:"]
    if not cases:
        lines.append("  (none)")
    for c in cases:
        root = next((w.answer for w in c.why_steps if w.is_root_cause), None)
        unverified = sum(1 for a in c.actions if a.status != "verified")
        lines.append(
            f'- "{c.title}" [{c.status}]' + (f", project {c.project}" if c.project and not project else "")
            + f"; whys: {len(c.why_steps)}"
            + (f"; root cause: {root}" if root else "; no root cause marked")
            + f"; actions: {len(c.actions)} ({unverified} not yet verified)"
        )
    return "\n".join(lines)


@bp.post("/chat")
def chat():
    if not ai_client.is_configured():
        return jsonify({"reply": "", "error": ai_client.NOT_CONFIGURED_MESSAGE})

    body = request.get_json(force=True) or {}
    messages = body.get("messages") or []
    if not messages:
        return jsonify({"error": "messages is required"}), 400

    incident_id = body.get("incident_id")
    if not incident_id:
        # The case list: an assistant over the (optionally project-filtered) set of cases.
        system = _LIST_PROMPT + "\n\n" + _build_list_context(body.get("project") or None)
        return jsonify({"reply": ai_client.chat(messages, system=system, max_tokens=1024)})
    incident = Incident.query.get_or_404(incident_id)

    system = SYSTEM_PROMPT + "\n\n" + _build_context(incident)
    reply = ai_client.chat(messages, system=system, max_tokens=1024)
    return jsonify({"reply": reply})


# ── "Guide me": the step-by-step coach ───────────────────────────────────────────────────────
#
# The Agent drawer is free chat. This is the guide that walks someone through one step of the
# method, one question at a time, and turns what they tell it into suggestion cards. The AI never
# writes to the case: each card is shown with Add / Skip, and only a person's click calls the
# real route (add a cause, add a why, add an action...). Cards are validated here against the
# case before they're shown, so a card can't point at a chain or step that doesn't exist.

GUIDE_STEPS = ("describe", "brainstorm", "whys", "actions")

_GUIDE_COMMON = """You are the guide inside The Fixer, coaching someone through root cause analysis
who may never have done one. Be a patient coach, not a lecturer: one short question at a time,
plain language, and a sentence of "why this matters" only when it helps. Never invent facts about
the case. Only turn something into a suggestion card when the person has actually told you it,
or when you clearly mark it as a hypothesis to check. Keep replies under 120 words, in plain
text with no markdown.

Whenever the person's last message gives you something for the case (a fact for the problem
statement, a possible cause, an answer to a why, an action), include a card that captures it in
their words, so one click puts it on the case. Then ask your next question.

Reply with a JSON object: {"reply": "<what you say next>", "suggestions": [<cards>]}. Use an empty
list when there's nothing to suggest yet. Allowed cards for this step are listed below; any other
card type will be dropped."""

_GUIDE_STEP = {
    "describe": """STEP: Describe the problem. A good problem statement says what failed, where, when, how
many or how much, and how it was found, and what's normal for comparison (is / is not). Ask about
whatever is missing, one item at a time. When you have enough, offer a rewritten statement using
only what they told you.
Cards: {"type": "description", "text": "<the full problem statement>"}""",
    "brainstorm": """STEP: Fishbone brainstorm. If they haven't brainstormed yet, explain in two sentences what a
fishbone is (sorting possible causes into six categories so nothing obvious is missed). Then walk
the categories one at a time: Man (people, skills, handoffs), Machine (equipment, tooling),
Method (procedure, instructions), Material (parts, lots, suppliers), Measurement (inspection,
gauges, data), Environment (temperature, humidity, time pressure). Ask a question specific to THIS
case for the category, e.g. for Material: "was this from a new lot or a new supplier?". Push back
on vague answers ("training", "human error") and help sharpen them into something checkable.
Skipping a category with nothing plausible is fine. When a couple of candidates look strong, say
which you'd chase first and why (a case can chase up to 3).
Cards: {"type": "cause", "category": "man|machine|method|material|measurement|environment",
"description": "<a specific, checkable cause>"}""",
    "whys": """STEP: 5 Whys. Work one chain at a time (the person may name one; otherwise pick the chain
with no root cause yet). Word the next "why" from the last answer: "Why did <last answer>?".
Flag a weak answer plainly: one that restates the symptom, blames a person, says "human error",
or names something the organization can't change. Ask "how do we know?" for evidence. When an
answer looks like a root cause, walk them through the test: can we control it, would fixing it
have prevented this, and does the evidence back it up. Five is a guide, not a rule.
When they answer your why, the card is that why: "question" is the why you asked, "answer" is
their answer, "evidence" is how they said they know. Don't put the NEXT why on a card until they
answer it.
Cards: {"type": "why", "chain_id": "<chain id from context>", "question": "<the why they answered>",
"answer": "<their answer>", "evidence": "<how they know, if given>"}""",
    "actions": """STEP: Actions. Explain the three kinds once if needed: containment (stop the bleeding now:
quarantine, sort, re-inspect), corrective (fix this occurrence), preventive (change something so
the root cause can't recur). Every root cause needs at least one corrective or preventive action.
Draft actions from the root causes, and for each ask how they'll know it worked (the verification
method) and who owns it.
Cards: {"type": "action", "kind": "containment|corrective|preventive", "description": "...",
"why_step_id": "<the root cause step id it answers, from context, or null>",
"verification_method": "<how we'll know it worked>"}""",
}

_CARD_TYPE = {"describe": "description", "brainstorm": "cause", "whys": "why", "actions": "action"}


def _clean(text) -> str:
    return str(text or "").strip()[:1000]


def _valid_cards(step: str, cards, incident: Incident) -> list[dict]:
    """Keep only well-formed cards of this step's type that point at things on this case."""
    out = []
    chain_ids = {c["id"] for c in incident.chains()}
    step_ids = {w.id for w in incident.why_steps}
    open_chain = next((c["id"] for c in incident.chains() if not c["root_step_id"]), None)
    for c in cards if isinstance(cards, list) else []:
        if not isinstance(c, dict) or c.get("type") != _CARD_TYPE[step]:
            continue
        if step == "describe" and _clean(c.get("text")):
            out.append({"type": "description", "text": _clean(c["text"])})
        elif step == "brainstorm" and c.get("category") in _CATEGORY_LABEL and _clean(c.get("description")):
            out.append({"type": "cause", "category": c["category"], "description": _clean(c["description"])})
        elif step == "whys" and _clean(c.get("question")):
            chain_id = c.get("chain_id") if c.get("chain_id") in chain_ids else (open_chain or "direct")
            out.append({"type": "why", "chain_id": chain_id, "question": _clean(c["question"]),
                        "answer": _clean(c.get("answer")) or None, "evidence": _clean(c.get("evidence")) or None})
        elif step == "actions" and c.get("kind") in ("containment", "corrective", "preventive") and _clean(c.get("description")):
            out.append({"type": "action", "kind": c["kind"], "description": _clean(c["description"]),
                        "why_step_id": c.get("why_step_id") if c.get("why_step_id") in step_ids else None,
                        "verification_method": _clean(c.get("verification_method")) or None})
    return out[:5]


@bp.post("/incidents/<incident_id>/guide")
def guide(incident_id):
    """One turn of the guide for one step. Body: {step, messages: [{role, content}]} with the
    conversation so far (the frontend owns it); an empty list starts the step."""
    incident = Incident.query.get_or_404(incident_id)
    body = request.get_json(force=True) or {}
    step = body.get("step")
    if step not in GUIDE_STEPS:
        return jsonify({"error": f"step must be one of {GUIDE_STEPS}"}), 400
    if not ai_client.is_configured():
        return jsonify({"reply": "", "suggestions": [], "error": ai_client.NOT_CONFIGURED_MESSAGE})

    messages = [m for m in (body.get("messages") or []) if m.get("role") in ("user", "assistant") and m.get("content")]
    if not messages:
        messages = [{"role": "user", "content": f"Start guiding me through the {step} step for this case."}]
    system = _GUIDE_COMMON + "\n\n" + _GUIDE_STEP[step] + "\n\nTHE CASE:\n" + _build_context(incident)
    data = ai_client.chat_json(messages, system=system, max_tokens=1200)
    if "error" in data and "reply" not in data:
        return jsonify({"reply": "", "suggestions": [], "error": data["error"]})
    return jsonify({
        "reply": _clean(data.get("reply")) or "What would you like to look at next?",
        "suggestions": _valid_cards(step, data.get("suggestions"), incident),
    })
