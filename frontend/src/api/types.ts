export type IncidentStatus = 'open' | 'investigating' | 'closed'

export interface Incident {
  id: string
  title: string
  description: string | null
  project: string | null
  portfolio: string | null
  reported_by: string | null
  status: IncidentStatus
  created_at: string
  closed_at: string | null
  fishbone_count: number
  why_count: number
  action_count: number
  has_root_cause: boolean
  open_action_count: number
  overdue_action_count: number
  close_override_reason: string | null
  /** Describe → Brainstorm → 5 Whys → Actions → Verify → Closed, each done or not. */
  stages: { key: StageKey; label: string; done: boolean }[]
  /** The first stage that isn't done: the one to work next. */
  stage: StageKey
  fishbone_causes?: FishboneCause[]
  why_steps?: WhyStep[]
  chains?: Chain[]
  actions?: Action[]
}

export type StageKey = 'describe' | 'brainstorm' | 'whys' | 'actions' | 'verify' | 'closed'

/** One 5-Whys chain: started from a promoted fishbone cause, or "direct" when the case skipped
 * the brainstorm. A case can chase up to three causes, each with its own root cause. */
export interface Chain {
  id: string
  cause: FishboneCause | null
  steps: WhyStep[]
  root_step_id: string | null
}

export const MAX_CHAINS = 3

/** The classic Ishikawa 6M's, minus Mother Nature (folded into Environment) — fixed, in render
 * order. Kept in sync with backend/models.py's FISHBONE_CATEGORIES by hand (small, stable set). */
export const FISHBONE_CATEGORIES = ['man', 'machine', 'method', 'material', 'measurement', 'environment'] as const
export type FishboneCategory = (typeof FISHBONE_CATEGORIES)[number]

export const FISHBONE_CATEGORY_LABEL: Record<FishboneCategory, string> = {
  man: 'Man',
  machine: 'Machine',
  method: 'Method',
  material: 'Material',
  measurement: 'Measurement',
  environment: 'Environment',
}

/** A candidate cause from the fishbone brainstorm. `promoted_why_step_id` is set once it's been
 * chosen to chase, which starts its own 5-Whys chain (see backend/models.py). */
export interface FishboneCause {
  id: string
  incident_id: string
  category: FishboneCategory
  description: string
  created_by: string | null
  created_at: string
  promoted_why_step_id: string | null
}

export interface WhyStep {
  id: string
  incident_id: string
  sequence: number
  question: string
  answer: string | null
  is_root_cause: boolean
  created_by: string | null
  created_at: string
  cause_id: string | null
  /** "How do we know?" */
  evidence: string | null
  evidence_kind: 'fact' | 'hypothesis' | null
  root_checks: RootChecks | null
}

/** The root-cause test, answered before a step can be marked the root cause. */
export interface RootChecks {
  controllable: boolean
  prevents_recurrence: boolean
  evidenced: boolean
}

export type ActionKind = 'containment' | 'corrective' | 'preventive'
export type ActionStatus = 'open' | 'in_progress' | 'done' | 'verified'

export interface Action {
  id: string
  incident_id: string
  kind: ActionKind
  description: string
  owner: string | null
  due_date: string | null
  status: ActionStatus
  verified_by: string | null
  verified_at: string | null
  created_at: string
  /** The why-step (usually a root cause) this action answers. */
  why_step_id: string | null
  /** How anyone will know it worked, decided up front. */
  verification_method: string | null
  effectiveness_check_date: string | null
  /** What showed it worked, recorded when it's verified. */
  verification_evidence: string | null
}

export const ACTION_KIND_LABEL: Record<ActionKind, string> = {
  containment: 'Containment',
  corrective: 'Corrective',
  preventive: 'Preventive',
}

export const ACTION_KIND_HINT: Record<ActionKind, string> = {
  containment: 'Stop the bleeding now: quarantine, sort, re-inspect.',
  corrective: 'Fix this occurrence.',
  preventive: "Change something so the root cause can't recur.",
}

/** A card from the "Guide me" coach. Nothing is written until a person clicks Add. */
export type GuideCard =
  | { type: 'description'; text: string }
  | { type: 'cause'; category: FishboneCategory; description: string }
  | { type: 'why'; chain_id: string; question: string; answer: string | null; evidence: string | null }
  | { type: 'action'; kind: ActionKind; description: string; why_step_id: string | null; verification_method: string | null }

export type GuideStep = 'describe' | 'brainstorm' | 'whys' | 'actions'

export interface GuideResponse {
  reply: string
  suggestions: GuideCard[]
  error?: string
}

export type EventTargetType = 'why_step' | 'action' | 'incident'
export type EventKind = 'note' | 'change'

/** One journal entry — an auto-captured field diff or a manual note. Same shape as Value
 * Stream's MapEvent: append-only, "change" rows are permanent, only "note" rows can be
 * deleted. The manual notes are the actual point of this feature — evidence a CAPA action was
 * performed, not just a status flip. */
export interface IncidentEvent {
  id: string
  incident_id: string
  created_at: string
  author: string | null
  target_type: EventTargetType | null
  target_id: string | null
  target_name: string | null
  kind: EventKind
  field: string | null
  old_value: string | null
  new_value: string | null
  note: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  reply: string
  error?: string
}

export interface DepotPerson {
  id: string
  name: string
  title: string | null
  is_admin: boolean
}
