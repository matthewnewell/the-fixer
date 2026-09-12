import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import './SplashPage.css'

// Matches backend/seed.py's DEMO_CASE_ID — a fixed (not random-uuid) id on the fully-worked
// demo case so this page can link straight at a real plan, same as Value Stream's /sample.
const DEMO_CASE_ID = 'demo-casting-rework'

const CHAIN = ['Why did it fail?', 'Why did that happen?', 'Why wasn’t it caught?', 'Why is there no check?']

const FEATURES = [
  {
    title: 'Ask why, not just what',
    body: 'A straight 5-Whys chain, one link at a time, until you reach something you can actually act on — not a form field for "root cause."',
  },
  {
    title: 'Corrective and preventive, together',
    body: 'Fixing this occurrence and stopping the mechanism from recurring are different actions. A real CAPA record needs both, and the preventive one should trace back to the cause you found.',
  },
  {
    title: 'An assistant that pushes back',
    body: '"Human error" and restated symptoms aren’t root causes. The assistant is scoped to your case and will say so — not a suggest button on every field, one conversation that knows the whole chain.',
  },
]

export default function SplashPage() {
  return (
    <div className="splash-page">
      <Nav />
      <div className="splash-page__scroll">
        <div className="splash-page__content">
          <header className="splash-hero">
            <h1 className="splash-hero__title">The Fixer</h1>
            <p className="splash-hero__sub">
              Root cause analysis and corrective/preventive action, guided by an AI root-cause
              specialist from the first why to the finished plan.
            </p>
            <div className="splash-hero__actions">
              <Link className="splash-btn splash-btn--primary" to="/">View cases</Link>
              <Link className="splash-btn splash-btn--ghost" to={`/incidents/${DEMO_CASE_ID}/plan`}>
                See a real CAPA plan
              </Link>
            </div>
          </header>

          <figure className="splash-figure">
            <Link className="splash-figure__link" to={`/incidents/${DEMO_CASE_ID}/plan`}>
              <div className="splash-chain">
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
                <div className="splash-chain__step splash-chain__step--connector">
                  <div className="splash-chain__connector">↓</div>
                </div>
                <div className="splash-chain__capa">
                  <div className="splash-chain__capa-label">📋 CAPA Plan</div>
                  <div className="splash-chain__capa-row">
                    <span className="splash-chain__capa-tag splash-chain__capa-tag--corrective">Corrective</span>
                    Re-order the casting to the corrected hole pattern and expedite.
                  </div>
                  <div className="splash-chain__capa-row">
                    <span className="splash-chain__capa-tag splash-chain__capa-tag--preventive">Preventive</span>
                    Add a long-lead-impact check to the design change review checklist.
                  </div>
                </div>
              </div>
            </Link>
            <figcaption className="splash-figure__caption">
              A real case, start to finish — click to open its CAPA plan.
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
    </div>
  )
}
