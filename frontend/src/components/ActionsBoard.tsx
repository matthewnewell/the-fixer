import { useState } from 'react'
import { ApiError } from '../api/client'
import { useCreateAction, useDeleteAction, usePeople, useUpdateAction, useUpdateIncident } from '../api/hooks'
import type { Action, ActionKind, ActionStatus, Incident, WhyStep } from '../api/types'
import { ACTION_KIND_HINT, ACTION_KIND_LABEL } from '../api/types'
import { usePersona } from '../lib/persona'
import './ActionsBoard.css'

const KINDS: ActionKind[] = ['containment', 'corrective', 'preventive']
const STATUS_LABEL: Record<ActionStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done, needs verifying',
  verified: 'Verified',
}

function rootSteps(incident: Incident): WhyStep[] {
  return (incident.chains ?? []).flatMap((c) => c.steps.filter((s) => s.is_root_cause))
}

/** The Actions step: every root cause with the actions that answer it, grouped by kind, and a form
 * to add one. Each action says who owns it and how anyone will know it worked. */
export function ActionsBoard({ incident, editable }: { incident: Incident; editable: boolean }) {
  const actions = incident.actions ?? []
  const roots = rootSteps(incident)
  const [adding, setAdding] = useState(false)

  return (
    <div className="ab">
      {roots.length > 0 && (
        <div className="ab__roots">
          {roots.map((r) => {
            const answered = actions.filter((a) => a.why_step_id === r.id && a.kind !== 'containment')
            return (
              <div key={r.id} className={`ab__root${answered.length ? '' : ' ab__root--open'}`}>
                <span className="ab__root-label">Root cause</span>
                <span className="ab__root-text">{r.answer}</span>
                <span className="ab__root-count">
                  {answered.length
                    ? `${answered.length} corrective/preventive action${answered.length === 1 ? '' : 's'}`
                    : 'Needs a corrective or preventive action'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {KINDS.map((k) => {
        const list = actions.filter((a) => a.kind === k)
        return (
          <section key={k} className="ab__group">
            <h3 className="ab__group-title">
              {ACTION_KIND_LABEL[k]} <span className="ab__group-hint">{ACTION_KIND_HINT[k]}</span>
            </h3>
            {list.length === 0 ? (
              <p className="ab__none">None yet.</p>
            ) : (
              list.map((a) => <ActionRow key={a.id} incident={incident} action={a} editable={editable} />)
            )}
          </section>
        )
      })}

      {editable &&
        (adding ? (
          <ActionForm incident={incident} onDone={() => setAdding(false)} />
        ) : (
          <button className="fx-btn fx-btn--primary" onClick={() => setAdding(true)}>
            + Add an action
          </button>
        ))}
    </div>
  )
}

export function ActionForm({ incident, onDone }: { incident: Incident; onDone: () => void }) {
  const create = useCreateAction(incident.id)
  const { data: people } = usePeople()
  const roots = rootSteps(incident)
  const [kind, setKind] = useState<ActionKind>(roots.length ? 'preventive' : 'containment')
  const [description, setDescription] = useState('')
  const [answers, setAnswers] = useState(roots[0]?.id ?? '')
  const [owner, setOwner] = useState('')
  const [due, setDue] = useState('')
  const [method, setMethod] = useState('')
  const [checkDate, setCheckDate] = useState('')
  const needsMethod = kind !== 'containment'

  return (
    <div className="ab-form">
      <div className="ab-form__kinds">
        {KINDS.map((k) => (
          <button key={k} className={kind === k ? 'ab-form__kind--on' : ''} onClick={() => setKind(k)}>
            {ACTION_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="ab-form__hint">{ACTION_KIND_HINT[kind]}</p>
      <label className="ab-form__field">
        What needs to happen?
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {kind !== 'containment' && (
        <label className="ab-form__field">
          Answers root cause
          <select value={answers} onChange={(e) => setAnswers(e.target.value)}>
            <option value="">Not tied to a root cause</option>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.answer}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="ab-form__row">
        <label className="ab-form__field">
          Owner
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Unassigned</option>
            {people?.people.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
                {p.title ? ` · ${p.title}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="ab-form__field">
          Due
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>
      <label className="ab-form__field">
        How will we know it worked?{needsMethod ? '' : ' (optional)'}
        <input
          value={method}
          placeholder="e.g. The next 5 cures log a full dwell; zero voids at NDI on the next 10 panels"
          onChange={(e) => setMethod(e.target.value)}
        />
      </label>
      {needsMethod && (
        <label className="ab-form__field ab-form__field--short">
          Check effectiveness on
          <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
        </label>
      )}
      {create.error && <p className="ab__error">{create.error.message}</p>}
      <div className="ab-form__actions">
        <button className="fx-btn fx-btn--ghost" onClick={onDone}>
          Cancel
        </button>
        <button
          className="fx-btn fx-btn--primary"
          disabled={!description.trim() || (needsMethod && !method.trim()) || create.isPending}
          onClick={() =>
            create.mutate(
              {
                kind,
                description: description.trim(),
                why_step_id: kind === 'containment' ? null : answers || null,
                owner: owner || undefined,
                due_date: due || undefined,
                verification_method: method.trim() || undefined,
                effectiveness_check_date: checkDate || undefined,
              },
              { onSuccess: onDone },
            )
          }
        >
          Add action
        </button>
      </div>
    </div>
  )
}

function ActionRow({ incident, action, editable }: { incident: Incident; action: Action; editable: boolean }) {
  const update = useUpdateAction(incident.id)
  const del = useDeleteAction(incident.id)
  const { persona } = usePersona()
  const [verifying, setVerifying] = useState(false)
  const [evidence, setEvidence] = useState('')
  const root = rootSteps(incident).find((r) => r.id === action.why_step_id)
  const overdue = action.due_date && action.status !== 'verified' && action.status !== 'done' && action.due_date < today()

  return (
    <div className={`ab-row ab-row--${action.status}`}>
      <div className="ab-row__main">
        <div className="ab-row__desc">{action.description}</div>
        <div className="ab-row__meta">
          <span>{action.owner ?? 'Unassigned'}</span>
          {action.due_date && <span className={overdue ? 'ab-row__overdue' : ''}>due {action.due_date}{overdue ? ' (overdue)' : ''}</span>}
          {root && <span className="ab-row__answers">answers: {root.answer}</span>}
        </div>
        {action.verification_method && (
          <div className="ab-row__method">
            <strong>We'll know it worked when:</strong> {action.verification_method}
            {action.effectiveness_check_date && <> · check on {action.effectiveness_check_date}</>}
          </div>
        )}
        {action.status === 'verified' && (
          <div className="ab-row__verified">
            ✓ Verified by {action.verified_by}
            {action.verification_evidence && <>: {action.verification_evidence}</>}
          </div>
        )}
      </div>
      <div className="ab-row__side">
        {editable && action.status !== 'verified' ? (
          <select
            value={action.status}
            onChange={(e) =>
              update.mutate({
                actionId: action.id,
                data: { status: e.target.value as ActionStatus, author: persona?.name, person_id: persona?.id },
              })
            }
          >
            {(['open', 'in_progress', 'done'] as ActionStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        ) : (
          <span className={`ab-row__status ab-row__status--${action.status}`}>{STATUS_LABEL[action.status]}</span>
        )}
        {editable && action.status === 'done' && !verifying && (
          <button className="fx-btn fx-btn--primary" onClick={() => setVerifying(true)}>
            Verify
          </button>
        )}
        {editable && action.status !== 'verified' && (
          <button className="ab-row__delete" onClick={() => del.mutate(action.id)} title="Delete this action">
            ✕
          </button>
        )}
      </div>
      {verifying && (
        <div className="ab-row__verify">
          <label className="ab-form__field">
            What showed it worked?
            <textarea
              rows={2}
              value={evidence}
              placeholder={action.verification_method ? `Checked: ${action.verification_method}` : 'e.g. Re-inspection report INS-118, zero voids'}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </label>
          {update.error && <p className="ab__error">{update.error.message}</p>}
          <div className="ab-form__actions">
            <button className="fx-btn fx-btn--ghost" onClick={() => setVerifying(false)}>
              Cancel
            </button>
            <button
              className="fx-btn fx-btn--primary"
              disabled={!evidence.trim() || !persona || update.isPending}
              onClick={() =>
                persona &&
                update.mutate(
                  {
                    actionId: action.id,
                    data: {
                      status: 'verified',
                      verified_by: persona.name,
                      verification_evidence: evidence.trim(),
                      author: persona.name,
                      person_id: persona.id,
                    },
                  },
                  { onSuccess: () => setVerifying(false) },
                )
              }
            >
              Verified, as {persona?.name ?? '…'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** The Verify step: every action that isn't verified yet, then closing the case. */
export function VerifyBoard({ incident, editable }: { incident: Incident; editable: boolean }) {
  const actions = incident.actions ?? []
  const pending = actions.filter((a) => a.status !== 'verified')
  const verified = actions.filter((a) => a.status === 'verified')
  return (
    <div className="ab">
      {pending.length === 0 ? (
        <p className="ab__none">{actions.length ? 'Every action is verified.' : 'No actions yet.'}</p>
      ) : (
        <section className="ab__group">
          <h3 className="ab__group-title">Waiting to be verified</h3>
          {pending.map((a) => (
            <ActionRow key={a.id} incident={incident} action={a} editable={editable} />
          ))}
        </section>
      )}
      {verified.length > 0 && (
        <section className="ab__group">
          <h3 className="ab__group-title">Verified</h3>
          {verified.map((a) => (
            <ActionRow key={a.id} incident={incident} action={a} editable={false} />
          ))}
        </section>
      )}
      {editable && <CloseCase incident={incident} />}
    </div>
  )
}

function CloseCase({ incident }: { incident: Incident }) {
  const update = useUpdateIncident(incident.id)
  const { persona } = usePersona()
  const [gaps, setGaps] = useState<string[] | null>(null)
  const [reason, setReason] = useState('')

  function close(override?: string) {
    update.mutate(
      { status: 'closed', override_reason: override, person_id: persona?.id },
      {
        onError: (e) => {
          const body = e instanceof ApiError ? (e.body as { gaps?: string[] }) : null
          if (body?.gaps) setGaps(body.gaps)
        },
      },
    )
  }

  return (
    <div className="ab-close">
      <div className="ab-close__head">
        <strong>Close the case</strong>
        <span className="ab-close__hint">Needs a root cause on every chain, an action on every root cause, and every action verified.</span>
      </div>
      {gaps ? (
        <>
          <p className="ab-close__gaps">Not yet: {gaps.join('; ')}.</p>
          <label className="ab-form__field">
            Close anyway? Say why.
            <input value={reason} placeholder="e.g. Duplicate of another case" onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="ab-form__actions">
            <button className="fx-btn fx-btn--ghost" onClick={() => setGaps(null)}>
              Keep working
            </button>
            <button className="fx-btn fx-btn--primary" disabled={!reason.trim()} onClick={() => close(reason.trim())}>
              Close with open items
            </button>
          </div>
        </>
      ) : (
        <button className="fx-btn fx-btn--primary" onClick={() => close()} disabled={update.isPending}>
          Close case
        </button>
      )}
    </div>
  )
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
