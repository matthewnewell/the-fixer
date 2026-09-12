import { Link, NavLink } from 'react-router-dom'
import './Nav.css'

// Matches backend/seed.py's DEMO_CASE_ID — a fixed (not random-uuid) id on the fully-worked
// demo case, same one the splash figure links to.
const DEMO_CASE_ID = 'demo-casting-rework'

export default function Nav() {
  return (
    <nav className="fx-nav">
      <NavLink to="/about" className="fx-nav__brand">
        The Fixer
      </NavLink>
      <div className="fx-nav__links">
        <NavLink
          to={`/incidents/${DEMO_CASE_ID}`}
          className={({ isActive }) => `fx-nav__link ${isActive ? 'fx-nav__link--active' : ''}`}
        >
          Demo
        </NavLink>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `fx-nav__link ${isActive ? 'fx-nav__link--active' : ''}`}
        >
          Cases
        </NavLink>
      </div>
      {/* Reachable from anywhere (splash, cases, an existing case) rather than only from the
          Cases page — opens straight into that page's own composer via ?new=1. */}
      <Link className="fx-btn fx-btn--primary fx-nav__new" to="/?new=1">+ New case</Link>
    </nav>
  )
}
