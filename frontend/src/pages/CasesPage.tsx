import { DrawerLayout } from '@conways/drawer'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCreateIncident, useHealth, useIncidents, useProjects } from '../api/hooks'
import type { IncidentStatus } from '../api/types'
import { usePersona } from '../lib/persona'
import './CasesPage.css'

// This app's own id in Conway's Depot's registry. A project's Fixer link carries the project NAME
// as its crosswalk ref, so the shared Journal can resolve a project from its name alone.
const DEPOT_APPLICATION_ID = '258a0d94-d960-479d-813f-aad09e66684e'

function daysOpen(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

const STATUS_LABEL: Record<IncidentStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  closed: 'Closed',
}

export default function CasesPage() {
  const navigate = useNavigate()
  // Linked from a project's page in Conway's Depot as /?project=<name> — open pre-filtered so a
  // project only sees its own cases.
  const [project, setProject] = useState(() => new URLSearchParams(window.location.search).get('project') ?? '')
  const [status, setStatus] = useState('')
  const { data: projects } = useProjects()
  const { data: incidents, isLoading } = useIncidents({ project: project || undefined, status: status || undefined })
  const createIncident = useCreateIncident()
  const { data: health } = useHealth()
  const { persona } = usePersona()
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [caseProject, setCaseProject] = useState('')

  // ?new=1 (e.g. from the splash page) opens straight into the composer.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new')) {
      startComposing()
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

  function startComposing() {
    setCaseProject(project)
    setComposing(true)
  }

  function handleCreate() {
    if (!title.trim()) return
    createIncident.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        project: caseProject || undefined,
        reported_by: persona?.name,
      },
      { onSuccess: (incident) => navigate(`/incidents/${incident.id}`) },
    )
  }

  return (
    <DrawerLayout
      key={project || 'all'}
      scrollMain={false}
      agent={{
        chatUrl: '/api/chat',
        chatExtra: { project: project || undefined },
        aiConfigured: health?.ai_configured ?? false,
        intro: project
          ? `Ask about ${project}'s cases: patterns across them, what needs attention first, or how to work a new one.`
          : 'Ask about the cases: patterns across them, what needs attention first, or how to work a new one.',
        starters: [
          'Which case needs attention first, and why?',
          'Do any of these cases share a root cause?',
          'How do I work a new case through The Fixer?',
        ],
      }}
      journal={
        project
          ? { resolve: { applicationId: DEPOT_APPLICATION_ID, externalRef: project }, personId: persona?.id }
          : { personId: persona?.id }
      }
    >
    <div className="cases-page">
      <div className="cases-page__inner">
        <header className="cases-page__header">
          <div>
            <h1 className="cases-page__title">{project ? `${project} cases` : 'Cases'}</h1>
            <p className="cases-page__hint">Root cause analysis and corrective/preventive actions.</p>
          </div>
          {!composing && (
            <button className="fx-btn fx-btn--primary" onClick={startComposing}>+ New case</button>
          )}
        </header>

        {composing && (
          <div className="new-case-form">
            <label className="new-case-form__field">
              What failed?
              <input
                autoFocus
                placeholder="e.g. Fairing lay-up voids found at NDI"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="new-case-form__field">
              What happened? <span className="new-case-form__opt">what, where, when, how many, how it was found</span>
              <textarea
                rows={3}
                placeholder="e.g. NDI on fairing S/N 004 found three voids in the lower skin, 40 mm from the edge band. Found at final inspection on the 14th; S/N 003 was clean."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="new-case-form__row">
              <label className="new-case-form__field">
                Project
                <select value={caseProject} onChange={(e) => setCaseProject(e.target.value)}>
                  <option value="">No project</option>
                  {(projects ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <span className="new-case-form__as">Reported by <strong>{persona?.name ?? '…'}</strong></span>
              <button className="fx-btn fx-btn--ghost" onClick={() => { setComposing(false); setTitle(''); setDescription('') }}>Cancel</button>
              <button className="fx-btn fx-btn--primary" onClick={handleCreate} disabled={!title.trim() || createIncident.isPending}>
                {createIncident.isPending ? 'Creating…' : 'Open case'}
              </button>
            </div>
          </div>
        )}

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
                {i.status !== 'closed' && (
                  <span className="case-card__stage">
                    Step: {i.stages.find((s) => s.key === i.stage)?.label}
                  </span>
                )}
                <span className={i.has_root_cause ? 'case-card__root case-card__root--found' : 'case-card__root'}>
                  {i.has_root_cause ? '✓ root cause found' : `${i.why_count} why${i.why_count === 1 ? '' : 's'} so far`}
                </span>
                {i.status !== 'closed' && <span className="case-card__age">open {daysOpen(i.created_at)}d</span>}
                {i.overdue_action_count > 0 && (
                  <span className="case-card__overdue">{i.overdue_action_count} overdue</span>
                )}
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
    </DrawerLayout>
  )
}
