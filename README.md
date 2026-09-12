# The Fixer

Root cause analysis (5 Whys) and Corrective/Preventive Action (CAPA), guided as you work.

## The idea

When something fails, the usual path is a paperwork exercise after the fact: a form with a
"root cause" text box nobody really interrogates, and a CAPA record that gets filled in to
close the ticket rather than to actually change anything. The Fixer tries to make working the
problem itself the easy part:

1. **5 Whys** — a straight chain, one link at a time: why did it fail, why did *that* happen,
   and so on, until you reach something you can act on. Fishbone (the categorical
   Man/Machine/Method/Material/Measurement/Environment view) is deliberately not built yet —
   5 Whys covers the common case with a much simpler data shape; fishbone is a real second
   canvas, not a variant of this one.
2. **Corrective and Preventive Actions** — fixing this occurrence and stopping the mechanism
   from recurring are different actions, tracked separately, each with an owner and a
   verification step (a CAPA action isn't done when someone says it's done — it's done when
   someone confirms it actually worked).
3. **An AI assistant scoped to the case**, not a "suggest" button on every field — the same
   lesson learned building Value Stream (a per-field AI-suggest badge was tried there and
   pulled back out in favor of one persistent chat pane). It's there to catch the classic
   5-Whys failure mode: an answer that just restates the symptom, or a chain that stalls out on
   "human error" instead of something the org can actually change.

## Stack

Same as Value Stream / Conway's Depot / Dude-Where's-My-Part — Flask + SQLAlchemy + SQLite
backend, React + TypeScript + Vite frontend, tied to the rest of the ecosystem only by
convention (plain-text `project` labels), no shared database.

## Running locally

```bash
# backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python app.py            # :8092, seeds demo data on first run

# frontend (separate terminal)
cd frontend
npm install
npm run dev                        # :5177, proxies /api to :8092
```

AI is optional and off by default (`AI_PROVIDER=none`) — everything except the chat pane works
without it. Set `AI_PROVIDER` to `claude`, `gemini`, or `ollama` (plus `AI_API_KEY` /
`AI_MODEL` as needed) to turn it on; see `backend/ai_client.py`.

## Data model

- **Incident** — what failed, tied to a project (plain-text label, same cross-app convention
  as everywhere else in this ecosystem).
- **WhyStep** — one link in the 5-Whys chain (`sequence`-ordered, strictly linear). Any step
  can be marked the root cause; the chain can keep growing past that mark.
- **Action** — a corrective or preventive action against the incident, with an owner, an
  optional due date, and a status that distinguishes "done" from "verified."

## Status

Early scaffold — demo data seeded (one closed case with a full 5-Whys chain and both action
types, one still being investigated), core loop (browse cases, work a why chain, add/verify
actions, chat about the case) works end to end.
