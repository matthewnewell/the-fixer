import { useState } from 'react'
import { useAddFishboneCause, useDeleteFishboneCause, usePromoteFishboneCause } from '../api/hooks'
import { FISHBONE_CATEGORIES, FISHBONE_CATEGORY_LABEL, MAX_CHAINS } from '../api/types'
import type { FishboneCategory, FishboneCause } from '../api/types'
import { usePersona } from '../lib/persona'
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

/** The Brainstorm step: candidate causes across the six fixed categories. Choosing a cause to
 * chase (up to three) starts its own 5-Whys chain; the rest stay on the record as considered.
 *
 * Drawn as an actual Ishikawa skeleton: three category cards above a horizontal spine, three
 * below, each connected to it by a short 40°-angled bone centered under/over its card. The
 * bones are fixed-size and live in their own band between the rows, so the geometry never
 * depends on how much text a category holds. */
export default function Fishbone({
  incidentId,
  causes,
  editing,
}: {
  incidentId: string
  causes: FishboneCause[]
  editing: boolean
}) {
  const addCause = useAddFishboneCause(incidentId)
  const deleteCause = useDeleteFishboneCause(incidentId)
  const promoteCause = usePromoteFishboneCause(incidentId)
  const { persona } = usePersona()

  const chasing = causes.filter((c) => c.promoted_why_step_id).length
  const canChase = editing && chasing < MAX_CHAINS

  if (!editing && causes.length === 0) {
    return <p className="fishbone__empty">No causes brainstormed.</p>
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
              canChase={canChase}
              editing={editing}
              onPromote={() => promoteCause.mutate({ causeId: cause.id, createdBy: persona?.name })}
              onDelete={() => deleteCause.mutate(cause.id)}
              promoting={promoteCause.isPending}
            />
          ))}
          {catCauses.length === 0 && !editing && <p className="fishbone__empty-cat">—</p>}
          {editing && (
            <AddCauseForm
              category={cat}
              onAdd={(description) => addCause.mutate({ category: cat, description, created_by: persona?.name })}
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
        <p className="fishbone__hint">
          Possible causes by category. Not every category needs one. Choose up to {MAX_CHAINS} to chase
          ({chasing} chosen); each gets its own 5 Whys.
        </p>
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
  canChase,
  editing,
  onPromote,
  onDelete,
  promoting,
}: {
  cause: FishboneCause
  canChase: boolean
  editing: boolean
  onPromote: () => void
  onDelete: () => void
  promoting: boolean
}) {
  return (
    <div className={`fishbone-chip${cause.promoted_why_step_id ? ' fishbone-chip--promoted' : ''}`}>
      <span className="fishbone-chip__text">{cause.description}</span>
      {cause.promoted_why_step_id && <span className="fishbone-chip__badge">Chasing: has its own 5 Whys</span>}
      {editing && !cause.promoted_why_step_id && (
        <div className="fishbone-chip__actions">
          {canChase && (
            <button className="fishbone-chip__promote" onClick={onPromote} disabled={promoting}>
              {promoting ? 'Starting…' : 'Chase this →'}
            </button>
          )}
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
