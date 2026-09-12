import { useState } from 'react'
import type { Action, ActionKind } from '../api/types'
import { useCreateAction, useUpdateAction } from '../api/hooks'
import './ActionsList.css'

const KIND_LABEL: Record<ActionKind, string> = { corrective: 'Corrective', preventive: 'Preventive' }

export default function ActionsList({ incidentId, actions }: { incidentId: string; actions: Action[] }) {
  const createAction = useCreateAction(incidentId)
  const [composing, setComposing] = useState(false)
  const [kind, setKind] = useState<ActionKind>('corrective')
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState('')
  const [dueDate, setDueDate] = useState('')

  function handleCreate() {
    if (!description.trim()) return
    createAction.mutate(
      { kind, description: description.trim(), owner: owner.trim() || undefined, due_date: dueDate || undefined },
      { onSuccess: () => { setDescription(''); setOwner(''); setDueDate(''); setComposing(false) } },
    )
  }

  return (
    <div className="actions-list">
      {actions.length === 0 && !composing && (
        <p className="actions-list__empty">No actions yet — once you've found something to act on, add a corrective or preventive action.</p>
      )}

      {actions.map((a) => (
        <ActionRow key={a.id} incidentId={incidentId} action={a} />
      ))}

      {!composing ? (
        <button className="fx-btn fx-btn--ghost" onClick={() => setComposing(true)}>+ Add action</button>
      ) : (
        <div className="action-form">
          <div className="action-form__kind">
            <button
              className={`action-form__kind-btn${kind === 'corrective' ? ' action-form__kind-btn--active' : ''}`}
              onClick={() => setKind('corrective')}
            >
              Corrective
            </button>
            <button
              className={`action-form__kind-btn${kind === 'preventive' ? ' action-form__kind-btn--active' : ''}`}
              onClick={() => setKind('preventive')}
            >
              Preventive
            </button>
          </div>
          <p className="action-form__hint">
            {kind === 'corrective'
              ? 'Fixes this specific occurrence.'
              : 'Changes something so the mechanism can’t recur — should trace back to the root cause.'}
          </p>
          <textarea
            rows={2}
            placeholder="What needs to happen?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="action-form__row">
            <input placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="action-form__actions">
            <button className="fx-btn fx-btn--primary" onClick={handleCreate} disabled={!description.trim() || createAction.isPending}>
              {createAction.isPending ? 'Adding…' : 'Add'}
            </button>
            <button className="fx-btn fx-btn--ghost" onClick={() => setComposing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionRow({ incidentId, action }: { incidentId: string; action: Action }) {
  const updateAction = useUpdateAction(incidentId)
  const [verifying, setVerifying] = useState(false)
  const [verifiedBy, setVerifiedBy] = useState('')

  return (
    <div className={`action-row action-row--${action.status}`}>
      <div className="action-row__main">
        <span className={`kind-pill kind-pill--${action.kind}`}>{KIND_LABEL[action.kind]}</span>
        <span className="action-row__desc">{action.description}</span>
        <span className="action-row__meta">
          {action.owner ?? 'unassigned'}
          {action.due_date && <> · due {action.due_date}</>}
        </span>
      </div>
      <div className="action-row__right">
        {action.status !== 'verified' && (
          <select
            value={action.status}
            onChange={(e) => updateAction.mutate({ actionId: action.id, data: { status: e.target.value as Action['status'] } })}
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
        )}
        {action.status === 'done' && !verifying && (
          <button className="fx-btn fx-btn--ghost" onClick={() => setVerifying(true)}>Verify</button>
        )}
        {verifying && (
          <div className="action-row__verify">
            <input placeholder="Your name" value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)} />
            <button
              className="fx-btn fx-btn--primary"
              disabled={!verifiedBy.trim()}
              onClick={() => updateAction.mutate({ actionId: action.id, data: { status: 'verified', verified_by: verifiedBy.trim() } })}
            >
              Confirm
            </button>
          </div>
        )}
        {action.status === 'verified' && (
          <span className="action-row__verified">✓ verified by {action.verified_by}</span>
        )}
      </div>
    </div>
  )
}
