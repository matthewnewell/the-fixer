import { DrawerLayout } from '@conways/drawer'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  useAddFishboneCause,
  useAddWhyStep,
  useCreateAction,
  useHealth,
  useIncident,
  useProjects,
  useUpdateIncident,
} from '../api/hooks'
import type { GuideCard, GuideStep, Incident, StageKey } from '../api/types'
import { ActionsBoard, VerifyBoard } from '../components/ActionsBoard'
import Fishbone from '../components/Fishbone'
import GuidePanel from '../components/GuidePanel'
import Nav from '../components/Nav'
import RecordView from '../components/RecordView'
import WhyLadders from '../components/WhyLadder'
import { usePersona } from '../lib/persona'
import './IncidentDetailPage.css'

// This app's own id in Conway's Depot's registry. The Fixer stays Depot-unaware (it never learns
// a Depot project id), so the shared Journal resolves the project from this + the incident id.
const DEPOT_APPLICATION_ID = '258a0d94-d960-479d-813f-aad09e66684e'

type View = StageKey | 'record'

const STEP_INTRO: Record<StageKey, string> = {
  describe: 'Say what failed, where, when, how many, and how it was found. A sharp problem statement makes every step after it easier.',
  brainstorm:
    'List possible causes by category so nothing obvious gets missed, then choose up to three worth chasing. Skip this if the cause is already obvious.',
  whys: 'For each cause you chose, keep asking why until you reach something the organization can change. Back each answer with evidence.',
  actions: 'Stop the bleeding if needed (containment), then give every root cause a corrective or preventive action, an owner, and a way to tell it worked.',
  verify: 'Confirm each action actually worked, with evidence, then close the case.',
  closed: 'This case is closed. The Record has everything that was found and done.',
}

const GUIDED: StageKey[] = ['describe', 'brainstorm', 'whys', 'actions']

/** One case, worked step by step: Describe → Brainstorm → 5 Whys → Actions → Verify → Closed.
 * The step bar says where the case is; the Guide coaches each step; the Record is the case as a
 * document, always current. */
export default function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>()
  const { data: incident, isLoading } = useIncident(incidentId)
  const { data: health } = useHealth()
  const { persona } = usePersona()
  const [params, setParams] = useSearchParams()
  const [guideOpen, setGuideOpen] = useState(false)

  if (isLoading || !incident) return <div className="incident-detail__loading">Loading…</div>

  const view: View = (params.get('view') as View) || incident.stage
  const setView = (v: View) => setParams({ view: v }, { replace: true })
  const editable = incident.status !== 'closed'
  const guideStep = GUIDED.includes(view as StageKey) && editable ? (view as GuideStep) : null

  return (
    <div className="incident-layout">
      <Nav />
      <DrawerLayout
        scrollMain={false}
        agent={{
          chatUrl: '/api/chat',
          chatExtra: { incident_id: incident.id },
          aiConfigured: health?.ai_configured ?? false,
          intro: 'Ask anything about this case. For step-by-step coaching, use Guide me on each step.',
          starters: [
            'Is the last answer a real cause, or just a restated symptom?',
            'What evidence would settle this?',
            'Are these actions enough to stop it happening again?',
          ],
        }}
        journal={{ resolve: { applicationId: DEPOT_APPLICATION_ID, externalRef: incident.id }, personId: persona?.id }}
      >
        <div className="incident-detail">
          <div className="incident-detail__inner">
            <CaseHeader incident={incident} />

            <nav className="steps" aria-label="Case steps">
              {incident.stages.map((s, i) => {
                const current = s.key === incident.stage
                return (
                  <button
                    key={s.key}
                    className={`steps__step${view === s.key ? ' steps__step--on' : ''}${s.done ? ' steps__step--done' : ''}${current ? ' steps__step--current' : ''}`}
                    onClick={() => setView(s.key)}
                    aria-current={view === s.key ? 'step' : undefined}
                  >
                    <span className="steps__dot">{s.done ? '✓' : i + 1}</span>
                    <span className="steps__label">{s.label}</span>
                    {current && !s.done && <span className="steps__now">now</span>}
                  </button>
                )
              })}
              <button className={`steps__record${view === 'record' ? ' steps__record--on' : ''}`} onClick={() => setView('record')}>
                📄 Record
              </button>
            </nav>

            {view === 'record' ? (
              <RecordView incident={incident} />
            ) : (
              <div className={`case-body${guideOpen && guideStep ? ' case-body--guided' : ''}`}>
                <div className="case-body__main">
                  <div className="step-head">
                    <p className="step-head__intro">{STEP_INTRO[view as StageKey]}</p>
                    {guideStep && !guideOpen && (
                      <button className="fx-btn fx-btn--primary step-head__guide" onClick={() => setGuideOpen(true)}>
                        🧭 Guide me
                      </button>
                    )}
                  </div>
                  <StepContent incident={incident} view={view as StageKey} editable={editable} />
                  <NextStep incident={incident} view={view as StageKey} onGo={setView} />
                </div>
                {guideOpen && guideStep && (
                  <GuideForStep incident={incident} step={guideStep} aiConfigured={health?.ai_configured ?? false} onClose={() => setGuideOpen(false)} />
                )}
              </div>
            )}
          </div>
        </div>
      </DrawerLayout>
    </div>
  )
}

function CaseHeader({ incident }: { incident: Incident }) {
  const days = Math.max(0, Math.round((Date.now() - new Date(incident.created_at).getTime()) / 86_400_000))
  return (
    <header className="case-head">
      <div className="incident-detail__badges">
        {incident.portfolio && <span className="incident-detail__badge">{incident.portfolio}</span>}
        {incident.project && (
          <Link className="incident-detail__badge incident-detail__badge--project" to={`/?project=${encodeURIComponent(incident.project)}`}>
            {incident.project}
          </Link>
        )}
        <span className={`status-pill status-pill--${incident.status}`}>{incident.status}</span>
      </div>
      <h1 className="incident-detail__title">{incident.title}</h1>
      <p className="case-head__meta">
        Reported by {incident.reported_by ?? 'someone'} · open {days} day{days === 1 ? '' : 's'}
        {incident.overdue_action_count > 0 && (
          <span className="case-head__overdue">
            {' '}
            · {incident.overdue_action_count} overdue action{incident.overdue_action_count === 1 ? '' : 's'}
          </span>
        )}
      </p>
    </header>
  )
}

function StepContent({ incident, view, editable }: { incident: Incident; view: StageKey; editable: boolean }) {
  switch (view) {
    case 'describe':
      return <DescribeStep incident={incident} editable={editable} />
    case 'brainstorm':
      return <Fishbone incidentId={incident.id} causes={incident.fishbone_causes ?? []} editing={editable} />
    case 'whys':
      return <WhyLadders incident={incident} editable={editable} />
    case 'actions':
      return <ActionsBoard incident={incident} editable={editable} />
    case 'verify':
      return <VerifyBoard incident={incident} editable={editable} />
    case 'closed':
      return <ClosedStep incident={incident} />
  }
}

function DescribeStep({ incident, editable }: { incident: Incident; editable: boolean }) {
  const update = useUpdateIncident(incident.id)
  const { data: projects } = useProjects()
  const [title, setTitle] = useState(incident.title)
  const [description, setDescription] = useState(incident.description ?? '')
  // A Guide suggestion (or another tab) can change the statement: follow it.
  useEffect(() => setDescription(incident.description ?? ''), [incident.description])
  useEffect(() => setTitle(incident.title), [incident.title])

  if (!editable) {
    return <p className="describe__read">{incident.description || 'No problem statement.'}</p>
  }
  return (
    <div className="describe">
      <label className="describe__field">
        What failed?
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== incident.title && update.mutate({ title: title.trim() })} />
      </label>
      <label className="describe__field">
        What happened? <span className="describe__opt">what, where, when, how many, how it was found, and what's normal</span>
        <textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (incident.description ?? '') && update.mutate({ description })}
        />
      </label>
      <label className="describe__field describe__field--short">
        Project
        <select value={incident.project ?? ''} onChange={(e) => update.mutate({ project: e.target.value || null })}>
          <option value="">No project</option>
          {(projects ?? []).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function ClosedStep({ incident }: { incident: Incident }) {
  const update = useUpdateIncident(incident.id)
  if (incident.status !== 'closed') {
    return <p className="describe__read">Finish verifying the actions, then close the case from the Verify step.</p>
  }
  return (
    <div className="closed-step">
      <p>
        Closed {incident.closed_at ? new Date(incident.closed_at).toLocaleDateString() : ''}.
        {incident.close_override_reason && <> Closed with open items: {incident.close_override_reason}</>}
      </p>
      <button className="fx-btn fx-btn--ghost" onClick={() => update.mutate({ status: 'investigating' })}>
        Reopen the case
      </button>
    </div>
  )
}

/** The way forward once a step is done: straight to the next one. */
function NextStep({ incident, view, onGo }: { incident: Incident; view: StageKey; onGo: (v: View) => void }) {
  const idx = incident.stages.findIndex((s) => s.key === view)
  const here = incident.stages[idx]
  const next = incident.stages[idx + 1]
  if (!here?.done || !next || next.key === 'closed') return null
  return (
    <div className="next-step">
      <span>✓ {here.label} is done.</span>
      <button className="fx-btn fx-btn--primary" onClick={() => onGo(next.key)}>
        Next: {next.label} →
      </button>
    </div>
  )
}

/** The Guide, wired to the real routes: a card only reaches the case through these. */
function GuideForStep({
  incident,
  step,
  aiConfigured,
  onClose,
}: {
  incident: Incident
  step: GuideStep
  aiConfigured: boolean
  onClose: () => void
}) {
  const update = useUpdateIncident(incident.id)
  const addCause = useAddFishboneCause(incident.id)
  const addWhy = useAddWhyStep(incident.id)
  const addAction = useCreateAction(incident.id)
  const { persona } = usePersona()

  function accept(card: GuideCard) {
    switch (card.type) {
      case 'description':
        return update.mutateAsync({ description: card.text })
      case 'cause':
        return addCause.mutateAsync({ category: card.category, description: card.description, created_by: persona?.name })
      case 'why':
        return addWhy.mutateAsync({
          cause_id: card.chain_id === 'direct' ? null : card.chain_id,
          question: card.question,
          answer: card.answer ?? undefined,
          evidence: card.evidence ?? undefined,
          created_by: persona?.name,
        })
      case 'action':
        return addAction.mutateAsync({
          kind: card.kind,
          description: card.description,
          why_step_id: card.why_step_id,
          verification_method: card.verification_method ?? undefined,
        })
    }
  }

  return <GuidePanel incidentId={incident.id} step={step} aiConfigured={aiConfigured} onAccept={accept} onClose={onClose} />
}
