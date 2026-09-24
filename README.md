# The Fixer

Root cause analysis (5 Whys) and Corrective/Preventive Action (CAPA), guided as you work.

## The idea

When something fails, the usual path is a paperwork exercise after the fact. The Fixer makes
working the problem the easy part, one step at a time, with a step bar that always shows where a
case is: **Describe → Brainstorm → 5 Whys → Actions → Verify → Closed**.

1. **Describe**: what failed, where, when, how many, and how it was found.
2. **Brainstorm (fishbone)**: possible causes across Man, Machine, Method, Material,
   Measurement, Environment. Choose up to **three** to chase; each gets its own 5-Whys chain.
3. **5 Whys**: a ladder per chain, from the problem down to a root cause. Each answer says how we
   know it (fact or hypothesis), weak answers get flagged ("human error", restated symptoms), a
   "therefore" check reads the chain back upward, and marking a root cause takes the root-cause
   test: we control it, fixing it would have prevented this, the evidence backs it up.
4. **Actions**: containment (now), corrective (this occurrence), preventive (the root cause).
   Every root cause needs a corrective or preventive action; every action has an owner from the
   Depot's people list and says up front how we'll know it worked.
5. **Verify**: an action is verified with evidence, by the person in the user menu.
6. **Closed**: closing needs every chain at a root cause, every root cause answered, and every
   action verified, or a stated reason for closing anyway.

**The Guide** ("Guide me" on each step) coaches someone who's never done root cause analysis:
one question at a time, specific to the case. It turns answers into suggestion cards (a problem
statement, a cause, a why with its evidence, an action); nothing goes on the case until a person
clicks Add, and the server drops any card that doesn't fit the case. The Agent/Journal drawer is
the ecosystem's shared one for free chat and the project Journal.

**The case is the record.** The Record view is the case's own data (problem, chains, root causes,
actions, verification evidence, history), always current, at its own link. There's no report to
generate. Milestones (case opened, root cause found, action verified, case closed) post to the
project's Journal in Conway's Depot, written by code from the change, credited to whoever did it.

## Stack

Same as Value Stream / Conway's Depot / MARTI: Flask + SQLAlchemy + SQLite
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
- **FishboneCause** — one brainstormed candidate cause, tagged with one of six fixed
  categories. `promoted_why_step_id` points at the WhyStep it became once promoted; a cause
  can only be promoted while the incident's `why_steps` list is still empty, and a promoted
  cause can't be deleted.
- **WhyStep** — one link in the 5-Whys chain (`sequence`-ordered, strictly linear). Any step
  can be marked the root cause; the chain can keep growing past that mark.
- **Action** — a corrective or preventive action against the incident, with an owner, an
  optional due date, and a status that distinguishes "done" from "verified."

## Status

Early scaffold — demo data seeded (one closed case with a full 5-Whys chain and both action
types, one still being investigated with a fishbone brainstorm behind its first why), core
loop (browse cases, brainstorm and promote a cause, work a why chain, add/verify actions,
chat about the case) works end to end.
