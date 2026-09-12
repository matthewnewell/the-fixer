import { useState } from 'react'
import type { WhyStep } from '../api/types'
import { useAddWhyStep, useDeleteWhyStep, useUpdateWhyStep } from '../api/hooks'
import './WhyChain.css'

/** The 5-Whys chain — a straight line, not a tree: each step is "why did the thing above
 * happen," down to (hopefully) something actionable. Deliberately no canvas library — this is
 * a simple ordered list with a connecting line, which is all a linear chain needs. Fishbone
 * (categorical, more than one cause at a level) is a real second UI, not built here. */
export default function WhyChain({ incidentId, steps }: { incidentId: string; steps: WhyStep[] }) {
  const addStep = useAddWhyStep(incidentId)
  const updateStep = useUpdateWhyStep(incidentId)
  const deleteStep = useDeleteWhyStep(incidentId)

  return (
    <div className="why-chain">
      {steps.map((step) => (
        <WhyStepCard
          key={step.id}
          step={step}
          onSave={(data) => updateStep.mutate({ stepId: step.id, data })}
          onDelete={() => deleteStep.mutate(step.id)}
        />
      ))}
      <button
        className="fx-btn fx-btn--ghost why-chain__add"
        onClick={() => addStep.mutate({})}
        disabled={addStep.isPending}
      >
        + Ask another why
      </button>
    </div>
  )
}

function WhyStepCard({
  step,
  onSave,
  onDelete,
}: {
  step: WhyStep
  onSave: (data: { question?: string; answer?: string; is_root_cause?: boolean }) => void
  onDelete: () => void
}) {
  const [answer, setAnswer] = useState(step.answer ?? '')
  const [question, setQuestion] = useState(step.question)

  const dirty = answer !== (step.answer ?? '') || question !== step.question

  return (
    <div className={`why-card${step.is_root_cause ? ' why-card--root' : ''}`}>
      <div className="why-card__number">{step.sequence}</div>
      <div className="why-card__body">
        <input
          className="why-card__question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onBlur={() => dirty && onSave({ question, answer })}
        />
        <textarea
          className="why-card__answer"
          rows={2}
          placeholder="Answer this why…"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onBlur={() => dirty && onSave({ question, answer })}
        />
        <div className="why-card__actions">
          <label className="why-card__root-toggle">
            <input
              type="checkbox"
              checked={step.is_root_cause}
              onChange={(e) => onSave({ is_root_cause: e.target.checked })}
            />
            Root cause
          </label>
          <button className="why-card__delete" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  )
}
