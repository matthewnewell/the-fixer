import { useState } from 'react'
import { useAddWhyStep, useDeleteWhyStep, useUpdateWhyStep } from '../api/hooks'
import type { Chain, Incident, RootChecks, WhyStep } from '../api/types'
import { FISHBONE_CATEGORY_LABEL } from '../api/types'
import { usePersona } from '../lib/persona'
import './WhyLadder.css'

/** Answers that usually mean the chain stopped too early. A nudge, not a rule. */
const WEAK_ANSWERS: { test: RegExp; flag: string }[] = [
  {
    test: /human error|operator error|\bmistake\b|careless|forgot|didn'?t follow|did not follow|not paying attention|should have known/i,
    flag: 'Blames a person. Ask what let the mistake happen: a missing check, a confusing step, no time.',
  },
  {
    test: /bad luck|\brandom\b|just happened|\bunknown\b|no reason/i,
    flag: "Not a cause yet. What made it possible?",
  },
  {
    test: /\b(training|communication|attention)\b\.?$/i,
    flag: 'Too vague to act on. Which training, which handoff, for whom?',
  },
]

const ROOT_TEST: { key: keyof RootChecks; label: string }[] = [
  { key: 'controllable', label: 'It is something we control (a process, design, check or system, not a person or luck).' },
  { key: 'prevents_recurrence', label: 'Fixing it would have prevented this problem.' },
  { key: 'evidenced', label: 'The evidence backs it up. It is not just a guess.' },
]

/** The 5 Whys, one ladder per chain: the problem at the top, each rung asking why the one above
 * happened, down to a root cause. A case can chase up to three causes, side by side. */
export default function WhyLadders({ incident, editable }: { incident: Incident; editable: boolean }) {
  const chains = incident.chains ?? []
  const addStep = useAddWhyStep(incident.id)
  const { persona } = usePersona()

  if (chains.length === 0) {
    return (
      <div className="ladders__empty">
        <p>
          No chain yet. Choose up to three causes to chase from the fishbone, or, if the cause is already obvious, start
          asking why directly.
        </p>
        {editable && (
          <button
            className="fx-btn fx-btn--ghost"
            onClick={() => addStep.mutate({ question: 'Why did this happen?', created_by: persona?.name })}
          >
            Start a chain without the fishbone
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`ladders ladders--${Math.min(chains.length, 3)}`}>
      {chains.map((c, i) => (
        <Ladder key={c.id} incident={incident} chain={c} index={i} editable={editable} />
      ))}
    </div>
  )
}

function Ladder({ incident, chain, index, editable }: { incident: Incident; chain: Chain; index: number; editable: boolean }) {
  const [therefore, setTherefore] = useState(false)
  const problem = incident.description || incident.title
  const root = chain.steps.find((s) => s.is_root_cause)

  return (
    <section className={`ladder${root ? ' ladder--rooted' : ''}`}>
      <div className="ladder__head">
        <span className="ladder__label">Chain {index + 1}</span>
        {chain.cause && (
          <span className="ladder__cause">from {FISHBONE_CATEGORY_LABEL[chain.cause.category]} cause</span>
        )}
        {root && <span className="ladder__done">Root cause found</span>}
        {chain.steps.length > 1 && (
          <button className="ladder__therefore-btn" onClick={() => setTherefore(!therefore)}>
            {therefore ? 'Hide' : 'Check'} the logic
          </button>
        )}
      </div>

      {therefore && <ThereforeCheck steps={chain.steps} problem={problem} />}

      <div className="rung rung--problem">
        <div className="rung__label">Problem</div>
        <div className="rung__answer">{problem}</div>
      </div>

      {chain.steps.map((s) => (
        <Rung key={s.id} incidentId={incident.id} step={s} editable={editable && !root} isRoot={s.is_root_cause} canMarkRoot={editable} />
      ))}

      {editable && !root && <NextWhy incidentId={incident.id} chain={chain} />}
    </section>
  )
}

function ThereforeCheck({ steps, problem }: { steps: WhyStep[]; problem: string }) {
  const answered = steps.filter((s) => s.answer)
  const upward = [...answered].reverse()
  return (
    <div className="therefore">
      <div className="therefore__intro">
        Read it back upward. Each line should lead to the next. If a "therefore" sounds wrong, a step is missing or
        wrong.
      </div>
      {upward.map((s, i) => (
        <div key={s.id} className="therefore__line">
          {i > 0 && <span className="therefore__word">therefore </span>}
          {s.answer}
        </div>
      ))}
      <div className="therefore__line therefore__line--problem">
        <span className="therefore__word">therefore </span>
        {problem}
      </div>
    </div>
  )
}

function Rung({
  incidentId,
  step,
  editable,
  isRoot,
  canMarkRoot,
}: {
  incidentId: string
  step: WhyStep
  editable: boolean
  isRoot: boolean
  canMarkRoot: boolean
}) {
  const update = useUpdateWhyStep(incidentId)
  const del = useDeleteWhyStep(incidentId)
  const { persona } = usePersona()
  const [answer, setAnswer] = useState(step.answer ?? '')
  const [question, setQuestion] = useState(step.question)
  const [evidence, setEvidence] = useState(step.evidence ?? '')
  const [testing, setTesting] = useState(false)
  const [checks, setChecks] = useState<RootChecks>(
    step.root_checks ?? { controllable: false, prevents_recurrence: false, evidenced: false },
  )
  const flags = WEAK_ANSWERS.filter((w) => step.answer && w.test.test(step.answer.trim()))
  const save = (data: Parameters<typeof update.mutate>[0]['data']) =>
    update.mutate({ stepId: step.id, data: { ...data, author: persona?.name, person_id: persona?.id } })

  return (
    <div className={`rung${isRoot ? ' rung--root' : ''}`}>
      <div className="rung__connector" aria-hidden="true" />
      <div className="rung__label">{isRoot ? '✓ Root cause' : `Why ${step.sequence}`}</div>
      {editable ? (
        <>
          <input
            className="rung__question-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onBlur={() => question !== step.question && save({ question })}
          />
          <textarea
            className="rung__answer-input"
            rows={2}
            placeholder="Because…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onBlur={() => answer !== (step.answer ?? '') && save({ answer })}
          />
        </>
      ) : (
        <>
          <div className="rung__question">{step.question}</div>
          <div className="rung__answer">{step.answer || <em className="rung__empty">No answer yet.</em>}</div>
        </>
      )}

      {flags.map((f) => (
        <div key={f.flag} className="rung__flag">
          ⚠ {f.flag}
        </div>
      ))}

      <div className="rung__evidence">
        <span className="rung__evidence-label">How do we know?</span>
        {editable ? (
          <>
            <input
              value={evidence}
              placeholder="An inspection report, a log, a measurement…"
              onChange={(e) => setEvidence(e.target.value)}
              onBlur={() => evidence !== (step.evidence ?? '') && save({ evidence })}
            />
            <span className="rung__kind">
              {(['fact', 'hypothesis'] as const).map((k) => (
                <button
                  key={k}
                  className={step.evidence_kind === k ? 'rung__kind--on' : ''}
                  onClick={() => save({ evidence_kind: step.evidence_kind === k ? null : k })}
                >
                  {k === 'fact' ? 'Fact' : 'Hypothesis'}
                </button>
              ))}
            </span>
          </>
        ) : (
          <span className="rung__evidence-text">
            {step.evidence || '—'}
            {step.evidence_kind && <span className={`rung__tag rung__tag--${step.evidence_kind}`}>{step.evidence_kind}</span>}
          </span>
        )}
      </div>

      {canMarkRoot && (
        <div className="rung__actions">
          {isRoot ? (
            <button className="rung__link" onClick={() => save({ is_root_cause: false })}>
              Not the root cause after all
            </button>
          ) : (
            editable && (
              <>
                {step.answer && !testing && (
                  <button className="rung__link" onClick={() => setTesting(true)}>
                    Is this the root cause?
                  </button>
                )}
                <button className="rung__link rung__link--danger" onClick={() => del.mutate(step.id)}>
                  Delete
                </button>
              </>
            )
          )}
        </div>
      )}

      {testing && (
        <div className="root-test">
          <div className="root-test__title">The root-cause test</div>
          {ROOT_TEST.map((t) => (
            <label key={t.key} className="root-test__item">
              <input
                type="checkbox"
                checked={checks[t.key]}
                onChange={(e) => setChecks({ ...checks, [t.key]: e.target.checked })}
              />
              {t.label}
            </label>
          ))}
          {!Object.values(checks).every(Boolean) && (
            <p className="root-test__hint">If any of these is no, keep asking why.</p>
          )}
          <div className="root-test__actions">
            <button
              className="fx-btn fx-btn--primary"
              disabled={!Object.values(checks).every(Boolean) || update.isPending}
              onClick={() =>
                update.mutate(
                  { stepId: step.id, data: { root_checks: checks, author: persona?.name } },
                  { onSuccess: () => save({ is_root_cause: true }) },
                )
              }
            >
              Mark as root cause
            </button>
            <button className="fx-btn fx-btn--ghost" onClick={() => setTesting(false)}>
              Keep asking why
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NextWhy({ incidentId, chain }: { incidentId: string; chain: Chain }) {
  const add = useAddWhyStep(incidentId)
  const { persona } = usePersona()
  const last = chain.steps[chain.steps.length - 1]
  const suggested = last?.answer ? `Why "${trimEnd(last.answer)}"?` : 'Why did this happen?'
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')

  return (
    <div className="rung rung--next">
      <div className="rung__connector" aria-hidden="true" />
      <div className="rung__label">Why {chain.steps.length + 1}</div>
      <input
        className="rung__question-input"
        value={question || suggested}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <textarea
        className="rung__answer-input"
        rows={2}
        placeholder="Because…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <button
        className="fx-btn fx-btn--primary rung__add"
        disabled={!answer.trim() || add.isPending}
        onClick={() =>
          add.mutate(
            {
              cause_id: chain.cause?.id ?? null,
              question: (question || suggested).trim(),
              answer: answer.trim(),
              created_by: persona?.name,
            },
            {
              onSuccess: () => {
                setQuestion('')
                setAnswer('')
              },
            },
          )
        }
      >
        Add this why
      </button>
    </div>
  )
}

function trimEnd(s: string) {
  return s.trim().replace(/[.!?]+$/, '')
}
