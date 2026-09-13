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
  fishbone_causes?: FishboneCause[]
  why_steps?: WhyStep[]
  actions?: Action[]
}

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

/** A candidate cause from the fishbone brainstorm — the predecessor step to the Why chain, not
 * a competing analysis mode. `promoted_why_step_id` is set once it's the one that started the
 * chain; promoting is only possible while that chain is still empty (see backend/models.py). */
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
}

export type ActionKind = 'corrective' | 'preventive'
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
