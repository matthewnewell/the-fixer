import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useHealth, useIncident, useUpdateIncident } from '../api/hooks'
import type { IncidentStatus } from '../api/types'
import Nav from '../components/Nav'
import WhyChain from '../components/WhyChain'
import ActionsList from '../components/ActionsList'
import ChatPanel from '../components/ChatPanel'
import './IncidentDetailPage.css'

type Tab = 'root_cause' | 'capa'

export default function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>()
  const { data: incident, isLoading } = useIncident(incidentId)
  const { data: health } = useHealth()
  const updateIncident = useUpdateIncident(incidentId ?? '')
  const [chatOpen, setChatOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('root_cause')
  // Every case opens read-only — a document you scan, not a form you're dropped into. Applies
  // uniformly (not just closed cases): editing is one click away, but the default should never
  // look like a data-entry screen.
  const [whyEditing, setWhyEditing] = useState(false)

  if (isLoading || !incident) return <div className="incident-detail__loading">Loading…</div>

  return (
    <div className="incident-layout">
      <Nav />
      <div className="incident-layout__row">
        <div className="incident-detail">
          <div className="incident-detail__inner">
            <header className="incident-detail__header">
              <div className="incident-detail__badges">
                {incident.portfolio && <span className="incident-detail__badge">{incident.portfolio}</span>}
                {incident.project && <span className="incident-detail__badge incident-detail__badge--project">{incident.project}</span>}
              </div>
              <div className="incident-detail__title-row">
                <h1 className="incident-detail__title">{incident.title}</h1>
                <div className="incident-detail__title-actions">
                  {tab === 'root_cause' ? (
                    <button className="fx-btn fx-btn--ghost" onClick={() => setWhyEditing((v) => !v)}>
                      {whyEditing ? 'Done editing' : '✎ Edit'}
                    </button>
                  ) : (
                    <Link className="fx-btn fx-btn--ghost" to={`/incidents/${incident.id}/plan`}>📄 Generate Report</Link>
                  )}
                  <select
                    className={`status-select status-select--${incident.status}`}
                    value={incident.status}
                    onChange={(e) => updateIncident.mutate({ status: e.target.value as IncidentStatus })}
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              {incident.description && <p className="incident-detail__desc">{incident.description}</p>}
              <p className="incident-detail__meta">reported by {incident.reported_by ?? 'unknown'}</p>
            </header>

            <nav className="incident-tabs">
              <button
                className={`incident-tabs__tab${tab === 'root_cause' ? ' incident-tabs__tab--active' : ''}`}
                onClick={() => setTab('root_cause')}
              >
                Root Cause
              </button>
              <button
                className={`incident-tabs__tab${tab === 'capa' ? ' incident-tabs__tab--active' : ''}`}
                onClick={() => setTab('capa')}
              >
                Corrective &amp; Preventive Actions
              </button>
            </nav>

            {tab === 'root_cause' ? (
              <section className="incident-detail__section" aria-label="Root cause">
                <WhyChain incidentId={incident.id} steps={incident.why_steps ?? []} editing={whyEditing} />
              </section>
            ) : (
              <section className="incident-detail__section" aria-label="Corrective and preventive actions">
                <ActionsList incidentId={incident.id} actions={incident.actions ?? []} />
              </section>
            )}
          </div>
        </div>

        {chatOpen ? (
          <ChatPanel
            incidentId={incident.id}
            aiConfigured={health?.ai_configured ?? false}
            onCollapse={() => setChatOpen(false)}
          />
        ) : (
          <button className="incident-layout__chat-tab" onClick={() => setChatOpen(true)} title="Open chat">
            ✨ Chat
          </button>
        )}
      </div>
    </div>
  )
}
