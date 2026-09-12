import { Link, useParams } from 'react-router-dom'
import { useIncident } from '../api/hooks'
import Nav from '../components/Nav'
import './CapaPlanPage.css'

const ACTION_STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In progress', done: 'Done', verified: 'Verified',
}

/** The documented plan: the same Incident + WhyStep + Action data as the case page, assembled
 * into one read-facing artifact instead of two edit-facing sections — the thing you'd actually
 * hand to an auditor or attach to a closure record. Deliberately not a separate app or a
 * separate data model: a CAPA plan *is* this incident's root cause and actions, just presented
 * as a plan. Print it (the print stylesheet strips the nav/back-link/print button) for a paper
 * or PDF record. */
export default function CapaPlanPage() {
  const { incidentId } = useParams<{ incidentId: string }>()
  const { data: incident, isLoading } = useIncident(incidentId)

  if (isLoading || !incident) return <div className="capa-plan__loading">Loading…</div>

  const rootCause = incident.why_steps?.find((w) => w.is_root_cause) ?? null
  const corrective = (incident.actions ?? []).filter((a) => a.kind === 'corrective')
  const preventive = (incident.actions ?? []).filter((a) => a.kind === 'preventive')

  return (
    <div className="capa-plan-layout">
      <Nav />
      <div className="capa-plan">
        <div className="capa-plan__toolbar">
          <Link className="capa-plan__back" to={`/incidents/${incident.id}`}>← Back to case</Link>
          <button className="fx-btn fx-btn--primary" onClick={() => window.print()}>Print / save as PDF</button>
        </div>

        <div className="capa-plan__sheet">
          <header className="capa-plan__header">
            <p className="capa-plan__kicker">Corrective &amp; Preventive Action Plan</p>
            <h1 className="capa-plan__title">{incident.title}</h1>
            <dl className="capa-plan__facts">
              {incident.portfolio && (<><dt>Portfolio</dt><dd>{incident.portfolio}</dd></>)}
              {incident.project && (<><dt>Project</dt><dd>{incident.project}</dd></>)}
              <dt>Reported by</dt><dd>{incident.reported_by ?? 'unknown'}</dd>
              <dt>Status</dt><dd><span className={`status-pill status-pill--${incident.status}`}>{incident.status}</span></dd>
              <dt>Opened</dt><dd>{new Date(incident.created_at).toLocaleDateString()}</dd>
              {incident.closed_at && (<><dt>Closed</dt><dd>{new Date(incident.closed_at).toLocaleDateString()}</dd></>)}
            </dl>
          </header>

          <section className="capa-plan__section">
            <h2>Problem</h2>
            <p className="capa-plan__prose">{incident.description || 'No problem statement recorded.'}</p>
          </section>

          <section className="capa-plan__section">
            <h2>Root cause</h2>
            {rootCause ? (
              <p className="capa-plan__root-cause">{rootCause.answer}</p>
            ) : (
              <p className="capa-plan__warning">
                No root cause has been marked yet — this plan is incomplete. Go to the case and mark the
                step in the 5-Whys chain that reaches the actual root cause.
              </p>
            )}
            {!!incident.why_steps?.length && (
              <ol className="capa-plan__chain">
                {incident.why_steps.map((w) => (
                  <li key={w.id} className={w.is_root_cause ? 'capa-plan__chain-step--root' : undefined}>
                    <span className="capa-plan__chain-q">{w.question}</span>
                    <span className="capa-plan__chain-a">{w.answer || '—'}</span>
                    {w.is_root_cause && <span className="capa-plan__chain-tag">root cause</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="capa-plan__section">
            <h2>Corrective action</h2>
            <p className="capa-plan__section-hint">Fixes this specific occurrence.</p>
            <ActionTable actions={corrective} empty="No corrective action recorded." />
          </section>

          <section className="capa-plan__section">
            <h2>Preventive action</h2>
            <p className="capa-plan__section-hint">Changes something so the mechanism can’t recur.</p>
            <ActionTable actions={preventive} empty="No preventive action recorded." />
          </section>

          <p className="capa-plan__generated">Generated {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}

function ActionTable({ actions, empty }: { actions: { id: string; description: string; owner: string | null; due_date: string | null; status: string; verified_by: string | null }[]; empty: string }) {
  if (actions.length === 0) return <p className="capa-plan__prose capa-plan__prose--muted">{empty}</p>
  return (
    <table className="capa-plan__table">
      <thead>
        <tr><th>Action</th><th>Owner</th><th>Due</th><th>Status</th></tr>
      </thead>
      <tbody>
        {actions.map((a) => (
          <tr key={a.id}>
            <td>{a.description}</td>
            <td>{a.owner ?? '—'}</td>
            <td>{a.due_date ?? '—'}</td>
            <td>
              {a.status === 'verified' ? `Verified (${a.verified_by})` : ACTION_STATUS_LABEL[a.status]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
