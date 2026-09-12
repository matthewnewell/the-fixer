import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCreateIncident, useIncidents, useProjects } from '../api/hooks'
import type { IncidentStatus } from '../api/types'
import './CasesPage.css'

const STATUS_LABEL: Record<IncidentStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  closed: 'Closed',
}

export default function CasesPage() {
  const navigate = useNavigate()
  const [project, setProject] = useState('')
  const [status, setStatus] = useState('')
  const { data: projects } = useProjects()
  const { data: incidents, isLoading } = useIncidents({ project: project || undefined, status: status || undefined })
  const createIncident = useCreateIncident()
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')

  // The Nav's "+ New case" button is reachable from anywhere and lands here with ?new=1 —
  // jump straight into the composer instead of making people click again once they arrive.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new')) {
      setComposing(true)
      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('new'); return next }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const sorted = useMemo(() => {
    if (!incidents) return []
    // Open/investigating first (needs a look), closed last; newest first within each.
    return [...incidents].sort((a, b) => {
      const aOpen = a.status !== 'closed', bOpen = b.status !== 'closed'
      if (aOpen !== bOpen) return aOpen ? -1 : 1
      return b.created_at.localeCompare(a.created_at)
    })
  }, [incidents])

  function handleCreate() {
    if (!title.trim()) return
    createIncident.mutate(
      { title: title.trim() },
      { onSuccess: (incident) => navigate(`/incidents/${incident.id}`) },
    )
  }

  return (
    <div className="cases-page">
      <div className="cases-page__inner">
        <header className="cases-page__header">
          <div>
            <h1 className="cases-page__title">Cases</h1>
            <p className="cases-page__hint">Root cause analysis and corrective/preventive actions.</p>
          </div>
          {!composing ? (
            <button className="fx-btn fx-btn--primary" onClick={() => setComposing(true)}>+ New case</button>
          ) : (
            <div className="new-case-form">
              <input
                autoFocus
                placeholder="What failed?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <button className="fx-btn fx-btn--primary" onClick={handleCreate} disabled={!title.trim() || createIncident.isPending}>
                {createIncident.isPending ? 'Creating…' : 'Create'}
              </button>
              <button className="fx-btn fx-btn--ghost" onClick={() => { setComposing(false); setTitle('') }}>Cancel</button>
            </div>
          )}
        </header>

        <div className="cases-page__filters">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="closed">Closed</option>
          </select>
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">All projects</option>
            {(projects ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {isLoading && <p className="cases-page__empty">Loading…</p>}
        {!isLoading && sorted.length === 0 && <p className="cases-page__empty">No cases yet.</p>}

        <div className="case-cards">
          {sorted.map((i) => (
            <button key={i.id} className="case-card" onClick={() => navigate(`/incidents/${i.id}`)}>
              <div className="case-card__top">
                <span className={`status-pill status-pill--${i.status}`}>{STATUS_LABEL[i.status]}</span>
                {i.project && <span className="case-card__project">{i.project}</span>}
              </div>
              <div className="case-card__title">{i.title}</div>
              <div className="case-card__meta">
                <span className={i.has_root_cause ? 'case-card__root case-card__root--found' : 'case-card__root'}>
                  {i.has_root_cause ? '✓ root cause found' : `${i.why_count} why${i.why_count === 1 ? '' : 's'} so far`}
                </span>
                {i.action_count > 0 && (
                  <span className="case-card__actions">
                    {i.action_count - i.open_action_count}/{i.action_count} actions verified
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
