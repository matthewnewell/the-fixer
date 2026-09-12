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

  if (isLoading || !incident) return <div className="incident-detail__loading">Loading…</div>

  return (
    <div className="incident-layout">
      <Nav />
      <div className="incident-layout__row">
        <div className="incident-detail">
          <div className="incident-detail__inner">
            <Link className="incident-detail__back" to="/">← Cases</Link>

            <header className="incident-detail__header">
              <div className="incident-detail__headline">
                <div className="incident-detail__badges">
                  {incident.portfolio && <span className="incident-detail__badge">{incident.portfolio}</span>}
                  {incident.project && <span className="incident-detail__badge incident-detail__badge--project">{incident.project}</span>}
                </div>
                <h1 className="incident-detail__title">{incident.title}</h1>
                {incident.description && <p className="incident-detail__desc">{incident.description}</p>}
                <p className="incident-detail__meta">reported by {incident.reported_by ?? 'unknown'}</p>
              </div>
              <div className="incident-detail__header-actions">
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
                CAPA
              </button>
            </nav>

            {tab === 'root_cause' ? (
              <section className="incident-detail__section">
                <h2 className="incident-detail__section-title">5 Whys</h2>
                <WhyChain incidentId={incident.id} steps={incident.why_steps ?? []} />
              </section>
            ) : (
              <section className="incident-detail__section">
                <div className="incident-detail__section-heading">
                  <h2 className="incident-detail__section-title">Corrective &amp; preventive actions</h2>
                  <Link className="fx-btn fx-btn--ghost" to={`/incidents/${incident.id}/plan`}>📋 Printable plan</Link>
                </div>
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
