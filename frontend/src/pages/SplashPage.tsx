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
    title: 'Built for your QMS, not against it',
    body: 'CAPA is an AS9100 requirement, not a suggestion. Root cause, corrective action, and preventive action live together, and nothing closes without verification. When the auditor asks for the record, it already exists.',
  },
  {
    title: 'An AI that won’t let you stop early',
    body: '"Human error" and a restated symptom are the two ways a 5-Whys chain quietly fails. The assistant reads the whole chain and pushes back on the easy answer instead of rubber-stamping it.',
  },
  {
    title: 'A report your team can act on today',
    body: 'One page: the problem, the root cause, the corrective fix, the preventive change — owners and due dates included. Generate it and hand it off. Not a file that goes in a drawer.',
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
              <div className="splash-flow">
                {CHAIN.map((q, i) => (
                  <div className="splash-flow__item" key={q}>
                    <div className="splash-flow__node">
                      <div className="splash-flow__bubble">{i + 1}</div>
                      <div className="splash-flow__text">{q}</div>
                    </div>
                    <div className="splash-flow__arrow">→</div>
                  </div>
                ))}
                <div className="splash-flow__item">
                  <div className="splash-flow__node splash-flow__node--root">
                    <div className="splash-flow__bubble splash-flow__bubble--root">✓</div>
                    <div className="splash-flow__text splash-flow__text--root">Root cause found</div>
                  </div>
                  <div className="splash-flow__arrow splash-flow__arrow--big">⇒</div>
                </div>
                <div className="splash-flow__capa">
                  <div className="splash-flow__capa-label">📋 CAPA Plan</div>
                  <div className="splash-flow__capa-row">
                    <span className="splash-flow__capa-tag splash-flow__capa-tag--corrective">Corrective</span>
                    Re-order the casting to the corrected hole pattern.
                  </div>
                  <div className="splash-flow__capa-row">
                    <span className="splash-flow__capa-tag splash-flow__capa-tag--preventive">Preventive</span>
                    Add a long-lead-impact design review check.
                  </div>
                </div>
              </div>
            </Link>
            <figcaption className="splash-figure__caption">
              A real case, start to finish — click to walk through root cause and CAPA.
            </figcaption>
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
