import { useState } from 'react'
import { useAddFishboneCause, useDeleteFishboneCause, usePromoteFishboneCause } from '../api/hooks'
import { FISHBONE_CATEGORIES, FISHBONE_CATEGORY_LABEL } from '../api/types'
import type { FishboneCategory, FishboneCause } from '../api/types'
import './Fishbone.css'

// Three categories above the spine, three below — the usual 6M split, in the fixed category
// order (see api/types.ts). Which three land on which side doesn't carry meaning; it's just
// the layout an Ishikawa diagram is recognizable in.
const TOP_CATEGORIES = FISHBONE_CATEGORIES.slice(0, 3)
const BOTTOM_CATEGORIES = FISHBONE_CATEGORIES.slice(3)

/** The predecessor step to the Why chain — a brainstorm across the six fixed categories, not a
 * canvas and not a competing analysis mode. Its only job is generating candidate causes worth
 * promoting; promoting one is what actually starts the linear WhyChain below it. Only shows
 * once the chain has started if there's fishbone history to show — a case that always went
 * straight to the Why chain never grows this section.
 *
 * Drawn as an actual Ishikawa skeleton (spine + a diagonal bone per category, angled the same
 * direction top and bottom so they read as sweeping toward the head) rather than a grid of
 * boxes — each bone is a small fixed-size SVG connector, decoupled from how much text a
 * category holds, so it stays a real diagram under editing, empty categories, and long cause
 * lists alike. */
export default function Fishbone({
  incidentId,
  causes,
  chainStarted,
  editing,
}: {
  incidentId: string
  causes: FishboneCause[]
  chainStarted: boolean
  editing: boolean
}) {
  const addCause = useAddFishboneCause(incidentId)
  const deleteCause = useDeleteFishboneCause(incidentId)
  const promoteCause = usePromoteFishboneCause(incidentId)

  if (chainStarted && causes.length === 0) return null

  if (!editing && !chainStarted && causes.length === 0) {
    return <p className="fishbone__empty">No causes brainstormed yet — click Edit to start.</p>
  }

  const causesFor = (cat: FishboneCategory) => causes.filter((c) => c.category === cat)

  const branch = (cat: FishboneCategory, side: 'top' | 'bottom') => {
    const catCauses = causesFor(cat)
    return (
      <CategoryBranch
        key={cat}
        category={cat}
        causes={catCauses}
        side={side}
        chainStarted={chainStarted}
        editing={editing}
        onAdd={(description) => addCause.mutate({ category: cat, description })}
        addPending={addCause.isPending}
        onPromote={(causeId) => promoteCause.mutate(causeId)}
        onDelete={(causeId) => deleteCause.mutate(causeId)}
        promoting={promoteCause.isPending}
      />
    )
  }

  return (
    <section className="fishbone">
      <div className="fishbone__head">
        <h2 className="fishbone__title">Fishbone brainstorm</h2>
        {!chainStarted && (
          <p className="fishbone__hint">
            Candidate causes by category — not every category needs one. Promote the most
            promising one to start the Why chain.
          </p>
        )}
      </div>

      <div className="fishbone__diagram">
        <div className="fishbone__row fishbone__row--top">
          {TOP_CATEGORIES.map((cat) => branch(cat, 'top'))}
        </div>
        <div className="fishbone__spine" aria-hidden="true" />
        <div className="fishbone__row fishbone__row--bottom">
          {BOTTOM_CATEGORIES.map((cat) => branch(cat, 'bottom'))}
        </div>
      </div>
    </section>
  )
}

function BoneConnector({ side, picked }: { side: 'top' | 'bottom'; picked: boolean }) {
  // Same diagonal both rows, sweeping down-right (top) / up-right (bottom) — i.e. always
  // leaning toward the spine's head end on the right, like real fishbone ribs.
  const [y1, y2] = side === 'top' ? [3, 21] : [21, 3]
  return (
    <svg
      className={`fishbone__bone${picked ? ' fishbone__bone--picked' : ''}`}
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line x1="6" y1={y1} x2="94" y2={y2} />
    </svg>
  )
}

function CategoryBranch({
  category,
  causes,
  side,
  chainStarted,
  editing,
  onAdd,
  addPending,
  onPromote,
  onDelete,
  promoting,
}: {
  category: FishboneCategory
  causes: FishboneCause[]
  side: 'top' | 'bottom'
  chainStarted: boolean
  editing: boolean
  onAdd: (description: string) => void
  addPending: boolean
  onPromote: (causeId: string) => void
  onDelete: (causeId: string) => void
  promoting: boolean
}) {
  const picked = causes.some((c) => c.promoted_why_step_id)

  const content = (
    <div className="fishbone__category-body">
      <h3 className="fishbone__category-label">{FISHBONE_CATEGORY_LABEL[category]}</h3>
      <div className="fishbone__causes">
        {causes.map((cause) => (
          <CauseChip
            key={cause.id}
            cause={cause}
            chainStarted={chainStarted}
            editing={editing}
            onPromote={() => onPromote(cause.id)}
            onDelete={() => onDelete(cause.id)}
            promoting={promoting}
          />
        ))}
        {causes.length === 0 && !editing && <p className="fishbone__empty-cat">—</p>}
        {editing && !chainStarted && (
          <AddCauseForm category={category} onAdd={onAdd} pending={addPending} />
        )}
      </div>
    </div>
  )

  const connector = <BoneConnector side={side} picked={picked} />

  return (
    <div className={`fishbone__category fishbone__category--${side}`}>
      {side === 'top' ? (
        <>
          {content}
          {connector}
        </>
      ) : (
        <>
          {connector}
          {content}
        </>
      )}
    </div>
  )
}

function CauseChip({
  cause,
  chainStarted,
  editing,
  onPromote,
  onDelete,
  promoting,
}: {
  cause: FishboneCause
  chainStarted: boolean
  editing: boolean
  onPromote: () => void
  onDelete: () => void
  promoting: boolean
}) {
  return (
    <div className={`fishbone-chip${cause.promoted_why_step_id ? ' fishbone-chip--promoted' : ''}`}>
      <span className="fishbone-chip__text">{cause.description}</span>
      {cause.promoted_why_step_id && <span className="fishbone-chip__badge">Started the chain ↓</span>}
      {editing && !chainStarted && !cause.promoted_why_step_id && (
        <div className="fishbone-chip__actions">
          <button className="fishbone-chip__promote" onClick={onPromote} disabled={promoting}>
            {promoting ? 'Promoting…' : 'Promote →'}
          </button>
          <button className="fishbone-chip__delete" onClick={onDelete} title="Remove this cause">✕</button>
        </div>
      )}
    </div>
  )
}

function AddCauseForm({
  category,
  onAdd,
  pending,
}: {
  category: FishboneCategory
  onAdd: (description: string) => void
  pending: boolean
}) {
  const [value, setValue] = useState('')

  function submit() {
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
  }

  return (
    <div className="fishbone-add">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={`+ ${FISHBONE_CATEGORY_LABEL[category]} cause…`}
      />
      <button className="fishbone-add__btn" onClick={submit} disabled={!value.trim() || pending}>
        Add
      </button>
    </div>
  )
}
