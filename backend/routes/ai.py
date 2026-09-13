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
(Corrective and Preventive Action) tool. An operator works an incident through three stages:
fishbone brainstorm (optional, only before the Why chain has started) -> a 5-Whys chain -> CAPA
actions.

Your job:
- If the Why chain is still empty, help with the fishbone brainstorm first: prompt across the
  six categories (Man, Machine, Method, Material, Measurement, Environment) and push back on a
  shallow one-word cause the same way you'd push back on a restated symptom — "training" isn't a
  candidate cause, "the backup inspectors' cert training wasn't scheduled this quarter" is. Not
  every category needs an entry; a category with nothing plausible is a real finding, not a gap
  to fill for its own sake. Once a couple of candidates look real, help pick the most promising
  one to promote — that's what starts the Why chain.
- Help ask the next "why" — a good next why digs into a *cause*, not a restated symptom. If the
  most recent answer just rephrases the problem ("it failed because it broke") rather than
  explaining a mechanism, say so plainly and suggest a sharper question.
- Notice when a chain has plausibly reached an actual root cause (something the org can act on
  — a missing check, a process gap, a design assumption) versus one that's stalled on "human
  error" or "bad luck," which are almost never real root causes on their own — push past those.
- When asked about actions, keep Corrective (fixes this specific occurrence) and Preventive
  (stops the mechanism from recurring) distinct — a good CAPA record usually has both, and a
  preventive action should trace back to the identified root cause, not just the symptom.

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

    lines.append("\n5 Whys chain so far:")
    if incident.why_steps:
        for w in incident.why_steps:
            root = "  <- marked as root cause" if w.is_root_cause else ""
            lines.append(f"  {w.sequence}. {w.question} {w.answer or '(not answered yet)'}{root}")
    else:
        lines.append("  (empty — nothing asked yet)")

    lines.append("\nActions so far:")
    if incident.actions:
        for a in incident.actions:
            lines.append(f"  - [{a.kind}] {a.description} (owner: {a.owner or 'unassigned'}, status: {a.status})")
    else:
        lines.append("  (none yet)")

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
        return jsonify({"error": "incident_id is required"}), 400
    incident = Incident.query.get_or_404(incident_id)

    system = SYSTEM_PROMPT + "\n\n" + _build_context(incident)
    reply = ai_client.chat(messages, system=system, max_tokens=1024)
    return jsonify({"reply": reply})
