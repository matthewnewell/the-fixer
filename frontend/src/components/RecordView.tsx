import type { Action, ActionKind, Incident } from '../api/types'
import { ACTION_KIND_HINT, ACTION_KIND_LABEL, FISHBONE_CATEGORY_LABEL } from '../api/types'
import Journal from './Journal'
import './RecordView.css'

const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In progress', done: 'Done', verified: 'Verified' }

/** The case as a record: problem, what was considered, each chain down to its root cause, the
 * actions and the evidence they worked, and the history of changes. Not a generated report: it's
 * the case's own data, always current, at its own link. Printing it from the browser gives paper
 * if anyone ever needs it. */
export default function RecordView({ incident }: { incident: Incident }) {
  const chains = incident.chains ?? []
  const actions = incident.actions ?? []
  const considered = (incident.fishbone_causes ?? []).filter((c) => !c.promoted_why_step_id)

  return (
    <div className="capa-plan__sheet">
      <header className="capa-plan__header">
        <p className="capa-plan__kicker">Root cause and corrective action record</p>
        <h1 className="capa-plan__title">{incident.title}</h1>
        <dl className="capa-plan__facts">
          {incident.portfolio && (
            <>
              <dt>Portfolio</dt>
              <dd>{incident.portfolio}</dd>
            </>
          )}
          {incident.project && (
            <>
              <dt>Project</dt>
              <dd>{incident.project}</dd>
            </>
          )}
          <dt>Reported by</dt>
          <dd>{incident.reported_by ?? 'unknown'}</dd>
          <dt>Status</dt>
          <dd>
            <span className={`status-pill status-pill--${incident.status}`}>{incident.status}</span>
          </dd>
          <dt>Opened</dt>
          <dd>{new Date(incident.created_at).toLocaleDateString()}</dd>
          {incident.closed_at && (
            <>
              <dt>Closed</dt>
              <dd>{new Date(incident.closed_at).toLocaleDateString()}</dd>
            </>
          )}
        </dl>
        {incident.close_override_reason && (
          <p className="capa-plan__warning">Closed with open items: {incident.close_override_reason}</p>
        )}
      </header>

      <section className="capa-plan__section">
        <h2>Problem</h2>
        <p className="capa-plan__prose">{incident.description || 'No problem statement recorded.'}</p>
      </section>

      <section className="capa-plan__section">
        <h2>Root cause{chains.length > 1 ? 's' : ''}</h2>
        {chains.length === 0 && <p className="capa-plan__warning">No 5-Whys chain yet.</p>}
        {chains.map((c, i) => {
          const root = c.steps.find((s) => s.is_root_cause)
          return (
            <div key={c.id} className="capa-plan__chain-block">
              {chains.length > 1 && (
                <h3 className="capa-plan__chain-title">
                  Chain {i + 1}
                  {c.cause && ` · from ${FISHBONE_CATEGORY_LABEL[c.cause.category]} cause`}
                </h3>
              )}
              {root ? (
                <p className="capa-plan__root-cause">{root.answer}</p>
              ) : (
                <p className="capa-plan__warning">No root cause marked on this chain yet.</p>
              )}
              <ol className="capa-plan__chain">
                {c.steps.map((w) => (
                  <li key={w.id} className={w.is_root_cause ? 'capa-plan__chain-step--root' : undefined}>
                    <span className="capa-plan__chain-q">{w.question}</span>
                    <span className="capa-plan__chain-a">{w.answer || '—'}</span>
                    {w.evidence && (
                      <span className="capa-plan__chain-ev">
                        Evidence{w.evidence_kind ? ` (${w.evidence_kind})` : ''}: {w.evidence}
                      </span>
                    )}
                    {w.is_root_cause && <span className="capa-plan__chain-tag">root cause</span>}
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
        {considered.length > 0 && (
          <p className="capa-plan__section-hint">
            Also considered and set aside:{' '}
            {considered.map((c) => `${c.description} (${FISHBONE_CATEGORY_LABEL[c.category]})`).join('; ')}.
          </p>
        )}
      </section>

      {(['containment', 'corrective', 'preventive'] as ActionKind[]).map((k) => (
        <section key={k} className="capa-plan__section">
          <h2>{ACTION_KIND_LABEL[k]} action</h2>
          <p className="capa-plan__section-hint">{ACTION_KIND_HINT[k]}</p>
          <ActionTable actions={actions.filter((a) => a.kind === k)} empty={`No ${k} action recorded.`} />
        </section>
      ))}

      <section className="capa-plan__section">
        <h2>History</h2>
        <Journal incidentId={incident.id} readOnly />
      </section>
    </div>
  )
}

function ActionTable({ actions, empty }: { actions: Action[]; empty: string }) {
  if (actions.length === 0) return <p className="capa-plan__prose capa-plan__prose--muted">{empty}</p>
  return (
    <table className="capa-plan__table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Owner</th>
          <th>Due</th>
          <th>How we'll know it worked</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {actions.map((a) => (
          <tr key={a.id}>
            <td>{a.description}</td>
            <td>{a.owner ?? '—'}</td>
            <td>{a.due_date ?? '—'}</td>
            <td>
              {a.verification_method ?? '—'}
              {a.effectiveness_check_date && <div className="capa-plan__sub">check on {a.effectiveness_check_date}</div>}
            </td>
            <td>
              {a.status === 'verified' ? (
                <>
                  Verified by {a.verified_by}
                  {a.verification_evidence && <div className="capa-plan__sub">{a.verification_evidence}</div>}
                </>
              ) : (
                STATUS_LABEL[a.status]
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
