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
  why_count: number
  action_count: number
  has_root_cause: boolean
  open_action_count: number
  why_steps?: WhyStep[]
  actions?: Action[]
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
