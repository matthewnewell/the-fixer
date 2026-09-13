import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import './SplashPage.css'

// Matches backend/seed.py's DEMO_CASE_ID — a fixed (not random-uuid) id on the fully-worked
// demo case. The splash figure still links here directly; the hero-level "Demo"/"Cases"
// buttons moved up into the navbar itself (Demo | Cases | New Case) so they don't duplicate it.
const DEMO_CASE_ID = 'demo-casting-rework'

const CHAIN = ['Why did it fail?', 'Why did that happen?', 'Why wasn’t it caught?', 'Why is there no check?']

// Geometry for the splash figure's fishbone diagram — a real Ishikawa skeleton (spine + tail +
// diagonal bones), not just a box of category chips. Coordinates live in a 0–150 × 0–200
// space matching the diagram's aspect-ratio box, so both the SVG lines and the absolutely
// positioned chip labels can be derived from the same numbers and stay lined up. Head at the
// top, tail at the bottom, feeding down into the connector arrow toward the Why chain.
const FISHBONE_VIEWBOX = { w: 150, h: 200 }
const FISHBONE_BONES = (
  [
    // Man (the promoted category, highlighted green) sits on the lower-right rib — nearest
    // the connector arrow into the 5 Whys panel, so the promoted cause visually flows straight
    // into the chain it started, instead of crossing back over from the opposite side.
    { category: 'Machine', side: 'left', y: 160 },
    { category: 'Man', side: 'right', y: 134 },
    { category: 'Method', side: 'left', y: 108 },
    { category: 'Material', side: 'right', y: 82 },
    { category: 'Measurement', side: 'left', y: 56 },
    { category: 'Environment', side: 'right', y: 30 },
  ] as const
).map((b) => {
  const tipX = b.side === 'left' ? 28 : 122
  const tipY = b.y + 16
  return {
    ...b,
    tipX,
    tipY,
    leftPct: (tipX / FISHBONE_VIEWBOX.w) * 100,
    topPct: (tipY / FISHBONE_VIEWBOX.h) * 100,
  }
})

const FEATURES = [
  {
    title: 'An objective voice',
    body: 'The Fixer is an AI assistant with no stake in the outcome — it helps you brainstorm candidate causes, then guides the 5 Whys to a root cause and an objective, pragmatic corrective and preventive action plan. No solution bias.',
  },
  {
    title: 'Actionable Reports',
    body: 'One page: the problem, the root cause, the corrective fix, the preventive change — owners and due dates included, ready to generate and share.',
  },
  {
    title: 'Built for your QMS',
    body: 'CAPA is an AS9100 requirement. Root cause, corrective action, and preventive action live together, with verification built in. When an auditor asks for evidence, here it is.',
  },
]

export default function SplashPage() {
  const [infoOpen, setInfoOpen] = useState(false)

  useEffect(() => {
    if (!infoOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setInfoOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [infoOpen])

  return (
    <div className="splash-page">
      <Nav />
      <div className="splash-page__scroll">
        <div className="splash-page__content">
          <header className="splash-hero">
            <h1 className="splash-hero__title">The Fixer</h1>
            <p className="splash-hero__sub">
              AI-guided root cause analysis — from fishbone brainstorm to CAPA plan.
              <button
                className="splash-info-btn"
                onClick={() => setInfoOpen(true)}
                aria-label="What is fishbone, root cause analysis, and CAPA?"
              >
                ?
              </button>
            </p>
          </header>

          <figure className="splash-figure">
            <Link className="splash-figure__link" to={`/incidents/${DEMO_CASE_ID}`}>
              <div className="splash-layout">
                <div className="splash-fishbone">
                  <div className="splash-fishbone__label">Fishbone</div>
                  <div className="splash-fishbone__diagram">
                    <svg
                      className="splash-fishbone__svg"
                      viewBox={`0 0 ${FISHBONE_VIEWBOX.w} ${FISHBONE_VIEWBOX.h}`}
                      aria-hidden="true"
                    >
                      {/* tail fin */}
                      <line x1="75" y1="182" x2="58" y2="198" />
                      <line x1="75" y1="182" x2="92" y2="198" />
                      {/* spine */}
                      <line x1="75" y1="182" x2="75" y2="22" />
                      {/* one bone per category, angled back toward the tail */}
                      {FISHBONE_BONES.map((b) => (
                        <line
                          key={b.category}
                          x1="75"
                          y1={b.y}
                          x2={b.tipX}
                          y2={b.tipY}
                          className={b.category === 'Man' ? 'splash-fishbone__bone--picked' : undefined}
                        />
                      ))}
                      {/* head, where every bone converges — the "effect" the chain picks up from */}
                      <circle className="splash-fishbone__head" cx="75" cy="18" r="5" />
                    </svg>
                    {FISHBONE_BONES.map((b) => (
                      <span
                        key={b.category}
                        className={`splash-fishbone__chip${b.category === 'Man' ? ' splash-fishbone__chip--picked' : ''}`}
                        style={{ left: `${b.leftPct}%`, top: `${b.topPct}%` }}
                      >
                        {b.category}
                      </span>
                    ))}
                  </div>
                  <div className="splash-fishbone__note">Brainstorm candidate causes, then promote one to start the chain.</div>
                </div>
                <div className="splash-connector">
                  <div className="splash-connector__line" />
                  <div className="splash-connector__head">▶</div>
                </div>
                <div className="splash-chain">
                  <div className="splash-chain__label">5 Whys</div>
                  {CHAIN.map((q, i) => (
                    <div key={q} className="splash-chain__step">
                      <div className="splash-chain__bubble">{i + 1}</div>
                      <div className="splash-chain__text">{q}</div>
                    </div>
                  ))}
                  <div className="splash-chain__step splash-chain__step--root">
                    <div className="splash-chain__bubble splash-chain__bubble--root">✓</div>
                    <div className="splash-chain__text splash-chain__text--root">Root cause: no design-change check against open long-lead orders.</div>
                  </div>
                </div>
                <div className="splash-connector">
                  <div className="splash-connector__line" />
                  <div className="splash-connector__head">▶</div>
                </div>
                <div className="splash-capa">
                  <div className="splash-capa__label">📋 Corrective and Preventive Action Plan</div>
                  <div className="splash-capa__row">
                    <div className="splash-capa__row-top">
                      <span className="splash-capa__tag splash-capa__tag--corrective">Corrective</span>
                      <span className="splash-capa__status splash-capa__status--done">Done</span>
                    </div>
                    <div className="splash-capa__row-text">Re-order the casting to the corrected hole pattern and expedite.</div>
                  </div>
                  <div className="splash-capa__row">
                    <div className="splash-capa__row-top">
                      <span className="splash-capa__tag splash-capa__tag--preventive">Preventive</span>
                      <span className="splash-capa__status splash-capa__status--open">Open</span>
                    </div>
                    <div className="splash-capa__row-text">Add a long-lead-impact check to the design change review checklist.</div>
                  </div>
                </div>
              </div>
            </Link>
          </figure>

          <div className="splash-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="splash-card">
                <div className="splash-card__heading">{f.title}</div>
                <p className="splash-card__body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {infoOpen && (
        <div className="splash-modal-backdrop" onClick={() => setInfoOpen(false)}>
          <div className="splash-modal" onClick={(e) => e.stopPropagation()}>
            <button className="splash-modal__close" onClick={() => setInfoOpen(false)} aria-label="Close">✕</button>
            <h2 className="splash-modal__title">Fishbone, Root Cause &amp; CAPA</h2>
            <p className="splash-modal__body">
              <strong>Fishbone brainstorm</strong> comes first when more than one thing could be
              the cause: candidates get sorted into six categories — man, machine, method,
              material, measurement, environment — before you commit to chasing one down.
            </p>
            <p className="splash-modal__body">
              <strong>Root cause analysis (5 Whys)</strong> means asking "why" repeatedly, one
              answer at a time, until you reach something you can actually change — starting
              from the cause you promoted out of the brainstorm, or straight from the problem
              when the cause is already obvious. Not the first plausible explanation, and not
              "human error," which is almost always a symptom of a process gap rather than a
              cause you can fix.
            </p>
            <p className="splash-modal__body">
              <strong>CAPA (Corrective &amp; Preventive Action)</strong> is what you do about it,
              split into two different actions: <em>corrective</em> fixes this specific
              occurrence, <em>preventive</em> changes something so the same root cause can't
              produce a repeat — and should trace directly back to the why chain that found it.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
