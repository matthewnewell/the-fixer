import { NavLink } from 'react-router-dom'
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
    </nav>
  )
}
