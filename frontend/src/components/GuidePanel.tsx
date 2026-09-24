import { useEffect, useRef, useState } from 'react'
import { useGuide } from '../api/hooks'
import type { ChatMessage, GuideCard, GuideStep } from '../api/types'
import { ACTION_KIND_LABEL, FISHBONE_CATEGORY_LABEL } from '../api/types'
import './GuidePanel.css'

type Turn = { role: 'user' | 'assistant'; content: string; cards?: GuideCard[] }

const STEP_TITLE: Record<GuideStep, string> = {
  describe: 'describing the problem',
  brainstorm: 'the fishbone brainstorm',
  whys: 'the 5 Whys',
  actions: 'choosing actions',
}

/** The step coach. It asks one question at a time and turns what you tell it into suggestion
 * cards; nothing touches the case until you click Add on a card (`onAccept` calls the real
 * route). The conversation belongs to this step and starts fresh when the step changes. */
export default function GuidePanel({
  incidentId,
  step,
  aiConfigured,
  onAccept,
  onClose,
}: {
  incidentId: string
  step: GuideStep
  aiConfigured: boolean
  onAccept: (card: GuideCard) => Promise<unknown>
  onClose: () => void
}) {
  const guide = useGuide(incidentId)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  function send(history: Turn[]) {
    setError(null)
    const messages: ChatMessage[] = history.map((t) => ({ role: t.role, content: t.content }))
    guide.mutate(
      { step, messages },
      {
        onSuccess: (res) => {
          if (res.error) setError(res.error)
          else setTurns([...history, { role: 'assistant', content: res.reply, cards: res.suggestions }])
        },
        onError: (e) => setError((e as Error).message),
      },
    )
  }

  // Start (or restart) the conversation for this step.
  useEffect(() => {
    setTurns([])
    setAdded(new Set())
    setSkipped(new Set())
    if (aiConfigured) send([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, aiConfigured])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, guide.isPending])

  function submit() {
    const text = input.trim()
    if (!text || guide.isPending) return
    const next = [...turns, { role: 'user' as const, content: text }]
    setTurns(next)
    setInput('')
    send(next)
  }

  async function accept(key: string, card: GuideCard) {
    await onAccept(card)
    setAdded((prev) => new Set(prev).add(key))
  }

  return (
    <aside className="guide">
      <div className="guide__head">
        <span>
          🧭 <strong>Guide</strong> · {STEP_TITLE[step]}
        </span>
        <button className="guide__close" onClick={onClose} aria-label="Close the guide">
          ✕
        </button>
      </div>

      {!aiConfigured ? (
        <p className="guide__off">The guide needs AI, which isn't configured for The Fixer.</p>
      ) : (
        <>
          <div className="guide__list" ref={listRef}>
            {turns.map((t, i) => (
              <div key={i} className={`guide__turn guide__turn--${t.role}`}>
                <div className="guide__bubble">{withBold(t.content)}</div>
                {t.cards?.map((card, j) => {
                  const key = `${i}-${j}`
                  if (skipped.has(key)) return null
                  return (
                    <div key={key} className={`guide-card${added.has(key) ? ' guide-card--added' : ''}`}>
                      <CardBody card={card} />
                      <div className="guide-card__actions">
                        {added.has(key) ? (
                          <span className="guide-card__done">Added ✓</span>
                        ) : (
                          <>
                            <button className="fx-btn fx-btn--primary" onClick={() => accept(key, card)}>
                              {card.type === 'description' ? 'Use this' : 'Add'}
                            </button>
                            <button className="fx-btn fx-btn--ghost" onClick={() => setSkipped((p) => new Set(p).add(key))}>
                              Skip
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            {guide.isPending && <div className="guide__thinking">Thinking…</div>}
            {error && <p className="guide__error">{error}</p>}
          </div>
          <div className="guide__composer">
            <textarea
              rows={2}
              value={input}
              placeholder="Answer, or ask it something…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            <button className="fx-btn fx-btn--primary" onClick={submit} disabled={!input.trim() || guide.isPending}>
              Send
            </button>
          </div>
          <p className="guide__note">Suggestions only go on the case when you click Add.</p>
        </>
      )}
    </aside>
  )
}

/** The guide is asked for plain text; if a **bold** slips through, show it bold, not as asterisks. */
function withBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}

function CardBody({ card }: { card: GuideCard }) {
  switch (card.type) {
    case 'description':
      return (
        <>
          <div className="guide-card__kind">Problem statement</div>
          <div className="guide-card__text">{card.text}</div>
        </>
      )
    case 'cause':
      return (
        <>
          <div className="guide-card__kind">Cause · {FISHBONE_CATEGORY_LABEL[card.category]}</div>
          <div className="guide-card__text">{card.description}</div>
        </>
      )
    case 'why':
      return (
        <>
          <div className="guide-card__kind">Add to the chain</div>
          <div className="guide-card__text">{card.question}</div>
          {card.answer && <div className="guide-card__sub">Answer: {card.answer}</div>}
          {card.evidence && <div className="guide-card__sub">Evidence: {card.evidence}</div>}
        </>
      )
    case 'action':
      return (
        <>
          <div className="guide-card__kind">{ACTION_KIND_LABEL[card.kind]} action</div>
          <div className="guide-card__text">{card.description}</div>
          {card.verification_method && <div className="guide-card__sub">We'll know it worked when: {card.verification_method}</div>}
        </>
      )
  }
}
