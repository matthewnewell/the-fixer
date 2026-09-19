import { DrawerLayout } from '@conways/drawer'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useHealth, useIncident, useUpdateIncident } from '../api/hooks'
import type { EventTargetType, IncidentStatus } from '../api/types'
import Nav from '../components/Nav'
import Fishbone from '../components/Fishbone'
import WhyChain from '../components/WhyChain'
import ActionsList from '../components/ActionsList'
import Journal from '../components/Journal'
import './IncidentDetailPage.css'

// This app's own id in Conway's Depot's registry. The Fixer stays Depot-unaware (it never learns
// a Depot project id), so the shared Journal resolves the project from this + the incident id.
const DEPOT_APPLICATION_ID = '258a0d94-d960-479d-813f-aad09e66684e'

type Tab = 'root_cause' | 'capa' | 'journal'

export default function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>()
  const { data: incident, isLoading } = useIncident(incidentId)
  const { data: health } = useHealth()
  const updateIncident = useUpdateIncident(incidentId ?? '')
  const [tab, setTab] = useState<Tab>('root_cause')
  // Every case opens read-only — a document you scan, not a form you're dropped into. Applies
  // uniformly (not just closed cases): editing is one click away, but the default should never
  // look like a data-entry screen.
  const [whyEditing, setWhyEditing] = useState(false)

  if (isLoading || !incident) return <div className="incident-detail__loading">Loading…</div>

  function jumpToTarget(targetType: EventTargetType) {
    setTab(targetType === 'action' ? 'capa' : 'root_cause')
  }

  return (
    <div className="incident-layout">
      <Nav />
      <DrawerLayout
        scrollMain={false}
        agent={{
          chatUrl: '/api/chat',
          chatExtra: { incident_id: incident.id },
          aiConfigured: health?.ai_configured ?? false,
          intro: "Ask about this case — whether an answer is a real cause or a restated symptom, and what to ask next.",
          starters: [
            'Is the last answer a real cause, or just a restated symptom?',
            "What's a sharper next why?",
            'Does this look like a real root cause yet?',
          ],
        }}
        journal={{ resolve: { applicationId: DEPOT_APPLICATION_ID, externalRef: incident.id } }}
      >
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
                  <select
                    className={`status-select status-select--${incident.status}`}
                    value={incident.status}
                    onChange={(e) => updateIncident.mutate({ status: e.target.value as IncidentStatus })}
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="closed">Closed</option>
                  </select>
                  <Link className="fx-btn fx-btn--ghost" to={`/incidents/${incident.id}/plan`} title="Generate the full report">📄 Generate Report</Link>
                  <button
                    className="fx-btn fx-btn--ghost"
                    onClick={() => setWhyEditing((v) => !v)}
                    title="Edit the 5-Whys chain"
                  >
                    {whyEditing ? 'Done editing' : '✎ Edit'}
                  </button>
                </div>
              </div>
              {incident.description && <p className="incident-detail__desc">{incident.description}</p>}
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
              <button
                className={`incident-tabs__tab${tab === 'journal' ? ' incident-tabs__tab--active' : ''}`}
                onClick={() => setTab('journal')}
              >
                Journal
              </button>
            </nav>

            {tab === 'root_cause' && (
              <section className="incident-detail__section" aria-label="Root cause">
                <Fishbone
                  incidentId={incident.id}
                  causes={incident.fishbone_causes ?? []}
                  chainStarted={(incident.why_steps ?? []).length > 0}
                  editing={whyEditing}
                />
                <WhyChain incidentId={incident.id} steps={incident.why_steps ?? []} editing={whyEditing} />
              </section>
            )}
            {tab === 'capa' && (
              <section className="incident-detail__section" aria-label="Corrective and preventive actions">
                <ActionsList incidentId={incident.id} actions={incident.actions ?? []} />
              </section>
            )}
            {tab === 'journal' && (
              <section className="incident-detail__section" aria-label="Journal">
                <Journal incidentId={incident.id} onTargetClick={jumpToTarget} />
              </section>
            )}
          </div>
        </div>

      </DrawerLayout>
    </div>
  )
}
