import { useState } from 'react'
import { useAddFishboneCause, useDeleteFishboneCause, usePromoteFishboneCause } from '../api/hooks'
import { FISHBONE_CATEGORIES, FISHBONE_CATEGORY_LABEL } from '../api/types'
import type { FishboneCategory, FishboneCause } from '../api/types'
import './Fishbone.css'

/** The predecessor step to the Why chain — a brainstorm across the six fixed categories, not a
 * canvas and not a competing analysis mode. Its only job is generating candidate causes worth
 * promoting; promoting one is what actually starts the linear WhyChain below it. Only shows
 * once the chain has started if there's fishbone history to show — a case that always went
 * straight to the Why chain never grows this section. */
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

  const byCategory = FISHBONE_CATEGORIES.map((cat) => ({
    category: cat,
    causes: causes.filter((c) => c.category === cat),
  }))

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

      <div className="fishbone__grid">
        {byCategory.map(({ category, causes: catCauses }) => (
          <div className="fishbone__category" key={category}>
            <h3 className="fishbone__category-label">{FISHBONE_CATEGORY_LABEL[category]}</h3>
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
              {catCauses.length === 0 && !editing && (
                <p className="fishbone__empty-cat">—</p>
              )}
              {editing && !chainStarted && (
                <AddCauseForm
                  category={category}
                  onAdd={(description) => addCause.mutate({ category, description })}
                  pending={addCause.isPending}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
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
