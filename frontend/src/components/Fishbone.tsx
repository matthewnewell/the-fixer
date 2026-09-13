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

// Horizontal center of each of the row's 3 equal columns, as a % of the row's width — where
// each bone's *tile-side* end lands, so a bone genuinely anchors under/over its category's
// middle rather than one of its edges. Shifted right of that center by the bone's own
// horizontal reach (see Fishbone.css — 30px at 40° projects ~23px horizontally), since each
// bone is positioned by its spine-side (pivot) end, which sits further toward the head than
// its tile-side end — the same direction every bone leans, so all of them point toward the
// spine's head rather than away from it. Independent of how tall any category's card ends up
// (a category with one short cause and one with a long paragraph still get identically angled
// bones), because the bones live in their own fixed-height band between the rows rather than
// being attached to each card's own edge.
const BONE_POSITIONS = ['calc(16.6667% + 23px)', 'calc(50% + 23px)', 'calc(83.3333% + 23px)']

/** The predecessor step to the Why chain — a brainstorm across the six fixed categories, not a
 * canvas and not a competing analysis mode. Its only job is generating candidate causes worth
 * promoting; promoting one is what actually starts the linear WhyChain below it. Only shows
 * once the chain has started if there's fishbone history to show — a case that always went
 * straight to the Why chain never grows this section.
 *
 * Drawn as an actual Ishikawa skeleton: three category cards above a horizontal spine, three
 * below, each connected to it by a short 40°-angled bone centered under/over its card. The
 * bones are fixed-size and live in their own band between the rows, so the geometry never
 * depends on how much text a category holds. */
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
  const isPicked = (cat: FishboneCategory) => causesFor(cat).some((c) => c.promoted_why_step_id)

  const branch = (cat: FishboneCategory) => {
    const catCauses = causesFor(cat)
    return (
      <div className="fishbone__category" key={cat}>
        <h3 className="fishbone__category-label">{FISHBONE_CATEGORY_LABEL[cat]}</h3>
        <div className="fishbone__causes">
          {catCauses.map((cause) => (
            <CauseChip
              key={cause.id}
              cause={cause}
              chainStarted={chainStarted}
              editing={editing}
              onPromote={() => promoteCause.mutate(cause.id)}
              onDelete={() => deleteCause.mutate(cause.id)}
              promoting={promoteCause.isPending}
            />
          ))}
          {catCauses.length === 0 && !editing && <p className="fishbone__empty-cat">—</p>}
          {editing && !chainStarted && (
            <AddCauseForm
              category={cat}
              onAdd={(description) => addCause.mutate({ category: cat, description })}
              pending={addCause.isPending}
            />
          )}
        </div>
      </div>
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
        <div className="fishbone__row">{TOP_CATEGORIES.map(branch)}</div>
        <SpineBand topPicked={TOP_CATEGORIES.map(isPicked)} bottomPicked={BOTTOM_CATEGORIES.map(isPicked)} />
        <div className="fishbone__row">{BOTTOM_CATEGORIES.map(branch)}</div>
      </div>
    </section>
  )
}

function SpineBand({ topPicked, bottomPicked }: { topPicked: boolean[]; bottomPicked: boolean[] }) {
  return (
    <div className="fishbone__spine-band" aria-hidden="true">
      <div className="fishbone__spine-line" />
      <div className="fishbone__spine-head" />
      {BONE_POSITIONS.map((x, i) => (
        <span
          key={`top-${i}`}
          className={`fishbone__bone fishbone__bone--top${topPicked[i] ? ' fishbone__bone--picked' : ''}`}
          style={{ left: x }}
        />
      ))}
      {BONE_POSITIONS.map((x, i) => (
        <span
          key={`bottom-${i}`}
          className={`fishbone__bone fishbone__bone--bottom${bottomPicked[i] ? ' fishbone__bone--picked' : ''}`}
          style={{ left: x }}
        />
      ))}
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
