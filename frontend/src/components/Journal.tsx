import { useState } from 'react'
import { useAddIncidentEvent, useDeleteIncidentEvent, useIncidentEvents } from '../api/hooks'
import type { EventTargetType, IncidentEvent } from '../api/types'
import { getAuthor, relativeTime, setAuthor } from '../lib/journal'
import './Journal.css'

interface JournalProps {
  incidentId: string
  /** Omit for the whole-case feed; pass to scope to one why-step / action. */
  target?: { type: EventTargetType; id: string; name: string }
  /** Clicking a target name jumps back to the tab that shows it (Root Cause / CAPA). */
  onTargetClick?: (targetType: EventTargetType) => void
}

interface Group {
  key: string
  ts: string
  author: string | null
  targetType: EventTargetType | null
  targetId: string | null
  targetName: string | null
  changes: IncidentEvent[]
  note: IncidentEvent | null
}

/** Groups the flat event list back into "one save" clusters (events from a single edit share
 * created_at exactly; the backend sorts changes before the note within each). Ported from
 * Value Stream's Journal. */
function groupEvents(events: IncidentEvent[]): Group[] {
  const groups: Group[] = []
  const byKey = new Map<string, Group>()
  for (const e of events) {
    const key = `${e.created_at}|${e.target_id ?? 'incident'}`
    let g = byKey.get(key)
    if (!g) {
      g = {
        key,
        ts: e.created_at,
        author: e.author,
        targetType: e.target_type,
        targetId: e.target_id,
        targetName: e.target_name,
        changes: [],
        note: null,
      }
      byKey.set(key, g)
      groups.push(g)
    }
    if (e.kind === 'change') g.changes.push(e)
    else g.note = e
  }
  return groups
}

const TARGET_LABEL: Record<string, string> = { why_step: 'why', action: 'action' }

export default function Journal({ incidentId, target, onTargetClick }: JournalProps) {
  const { data: events, isLoading } = useIncidentEvents(incidentId, target?.id)
  const addEvent = useAddIncidentEvent(incidentId)
  const deleteEvent = useDeleteIncidentEvent(incidentId)

  const [text, setText] = useState('')
  const [name, setName] = useState(getAuthor())
  const author = getAuthor()

  function submit() {
    const note = text.trim()
    if (!note) return
    if (name.trim() && name.trim() !== author) setAuthor(name)
    addEvent.mutate(
      {
        note,
        author: (name.trim() || author) || undefined,
        ...(target
          ? { target_type: target.type, target_id: target.id, target_name: target.name }
          : { target_type: 'incident' as const }),
      },
      {
        onSuccess: () => setText(''),
        onError: (err) => console.error('[journal] add note failed', err),
      },
    )
  }

  const groups = groupEvents(events ?? [])
  const scoped = !!target

  return (
    <div className="journal">
      <div className="journal__composer">
        <textarea
          className="journal__input"
          rows={2}
          placeholder={
            scoped
              ? 'Note the evidence — what was actually done, a PO number, an inspection report…'
              : 'What happened? A decision, a call, evidence an action was performed…'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="journal__composer-row">
          {!author && (
            <input
              className="journal__name"
              placeholder="your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          {author && <span className="journal__as">as {author}</span>}
          <button className="journal__add" onClick={submit} disabled={!text.trim() || addEvent.isPending}>
            {addEvent.isPending ? 'Adding…' : 'Add note'}
          </button>
        </div>
        {addEvent.isError && (
          <p className="journal__error">
            Couldn't add the note: {(addEvent.error as Error)?.message ?? 'unknown error'}
          </p>
        )}
      </div>

      {deleteEvent.isError && (
        <p className="journal__error">
          Couldn't delete that entry: {(deleteEvent.error as Error)?.message ?? 'unknown error'}
        </p>
      )}

      {isLoading ? (
        <p className="journal__empty">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="journal__empty">
          {scoped
            ? 'No entries for this item yet.'
            : 'Nothing logged yet. Edits are recorded automatically; add a note for the evidence.'}
        </p>
      ) : (
        <ol className="journal__feed">
          {groups.map((g) => (
            <li key={g.key} className="journal__entry">
              <div className="journal__meta">
                <span className="journal__author">{g.author || 'Someone'}</span>
                {!scoped && g.targetName && (
                  <span className="journal__on">
                    · {TARGET_LABEL[g.targetType ?? ''] ?? ''}{' '}
                    {g.targetType && (g.targetType === 'why_step' || g.targetType === 'action') && onTargetClick ? (
                      <button className="journal__target-link" onClick={() => onTargetClick(g.targetType!)}>
                        {g.targetName}
                      </button>
                    ) : (
                      <strong>{g.targetName}</strong>
                    )}
                  </span>
                )}
                <span className="journal__time">{relativeTime(g.ts)}</span>
              </div>

              {g.changes.length > 0 && (
                <ul className="journal__changes">
                  {g.changes.map((c) => (
                    <li key={c.id}>
                      {c.field}: <span className="journal__old">{c.old_value}</span>
                      {' → '}
                      <span className="journal__new">{c.new_value}</span>
                    </li>
                  ))}
                </ul>
              )}

              {g.note && (
                <div className="journal__note">
                  <span>{g.note.note}</span>
                  <button className="journal__del" title="Delete this note" onClick={() => deleteEvent.mutate(g.note!.id)}>
                    ✕
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
