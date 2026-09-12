import { useState } from 'react'
import type { WhyStep } from '../api/types'
import { useAddWhyStep, useDeleteWhyStep, useUpdateWhyStep } from '../api/hooks'
import './WhyChain.css'

/** The 5-Whys chain — a straight line, not a tree: each step is "why did the thing above
 * happen," down to (hopefully) something actionable. Deliberately no canvas library — this is
 * a simple ordered list with a connecting line, which is all a linear chain needs. Fishbone
 * (categorical, more than one cause at a level) is a real second UI, not built here.
 *
 * `editing` is owned by the parent page (its Edit/Done toggle) — read mode renders each step
 * as plain text (a document you scan), edit mode swaps in the text-field/checkbox/delete form.
 * Read is the default everywhere, not just for closed cases: a case page shouldn't look like a
 * data-entry screen the moment you open it. */
export default function WhyChain({ incidentId, steps, editing }: { incidentId: string; steps: WhyStep[]; editing: boolean }) {
  const addStep = useAddWhyStep(incidentId)
  const updateStep = useUpdateWhyStep(incidentId)
  const deleteStep = useDeleteWhyStep(incidentId)

  if (steps.length === 0) {
    return editing ? (
      <div className="why-chain">
        <AddWhyButton onClick={() => addStep.mutate({})} disabled={addStep.isPending} />
      </div>
    ) : (
      <p className="why-chain__empty">No whys asked yet — click Edit to start the chain.</p>
    )
  }

  return (
    <div className="why-chain">
      {steps.map((step) =>
        editing ? (
          <WhyStepEditCard
            key={step.id}
            step={step}
            onSave={(data) => updateStep.mutate({ stepId: step.id, data })}
            onDelete={() => deleteStep.mutate(step.id)}
          />
        ) : (
          <WhyStepReadRow key={step.id} step={step} />
        ),
      )}
      {editing && <AddWhyButton onClick={() => addStep.mutate({})} disabled={addStep.isPending} />}
    </div>
  )
}

function AddWhyButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button className="fx-btn fx-btn--ghost why-chain__add" onClick={onClick} disabled={disabled}>
      + Ask another why
    </button>
  )
}

function WhyStepReadRow({ step }: { step: WhyStep }) {
  return (
    <div className={`why-card${step.is_root_cause ? ' why-card--root' : ''}`}>
      <div className="why-card__number">{step.is_root_cause ? '✓' : step.sequence}</div>
      <div className="why-card__body">
        <div className="why-card__question-text">{step.question}</div>
        {step.answer ? (
          <div className="why-card__answer-text">{step.answer}</div>
        ) : (
          <div className="why-card__answer-text why-card__answer-text--empty">No answer yet.</div>
        )}
        {step.is_root_cause && <span className="why-card__root-tag">Root cause</span>}
      </div>
    </div>
  )
}

function WhyStepEditCard({
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
