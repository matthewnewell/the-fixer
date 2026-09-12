import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import './SplashPage.css'

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
              Root cause analysis and corrective/preventive action, guided as you work — not a
              form you fill out after the fact.
            </p>
            <div className="splash-hero__actions">
              <Link className="splash-btn splash-btn--primary" to="/">View cases</Link>
            </div>
          </header>

          <figure className="splash-figure">
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
            </div>
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
