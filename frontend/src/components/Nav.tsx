import { Link, NavLink } from 'react-router-dom'
import './Nav.css'

export default function Nav() {
  return (
    <nav className="fx-nav">
      <NavLink to="/about" className="fx-nav__brand">
        The Fixer
      </NavLink>
      <div className="fx-nav__links">
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
