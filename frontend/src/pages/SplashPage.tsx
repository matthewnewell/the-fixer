import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import './SplashPage.css'

// Matches backend/seed.py's DEMO_CASE_ID — a fixed (not random-uuid) id on the fully-worked
// demo case so this page can link straight at a real case, same as Value Stream's /sample.
const DEMO_CASE_ID = 'demo-casting-rework'

const CHAIN = ['Why did it fail?', 'Why did that happen?', 'Why wasn’t it caught?', 'Why is there no check?']

const FEATURES = [
  {
    title: 'An objective voice',
    body: 'The assistant has no stake in the outcome — it reads the whole chain and offers an objective, AI-guided perspective that helps you catch solution bias early and follow the evidence to the real cause.',
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
              AI-guided root cause analysis and CAPA plans.
              <button
                className="splash-info-btn"
                onClick={() => setInfoOpen(true)}
                aria-label="What is root cause analysis and CAPA?"
              >
                ?
              </button>
            </p>
            <div className="splash-hero__actions">
              <Link className="splash-btn splash-btn--ghost" to={`/incidents/${DEMO_CASE_ID}`}>Demo</Link>
              <Link className="splash-btn splash-btn--primary" to="/">Cases</Link>
            </div>
          </header>

          <figure className="splash-figure">
            <Link className="splash-figure__link" to={`/incidents/${DEMO_CASE_ID}`}>
              <div className="splash-layout">
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
            <h2 className="splash-modal__title">Root Cause Analysis &amp; CAPA</h2>
            <p className="splash-modal__body">
              <strong>Root cause analysis (5 Whys)</strong> means asking "why" repeatedly, one
              answer at a time, until you reach something you can actually change — not the
              first plausible explanation, and not "human error," which is almost always a
              symptom of a process gap rather than a cause you can fix.
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
