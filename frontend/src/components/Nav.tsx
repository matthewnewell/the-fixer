import { AppHeader, tabClass } from '@conways/drawer'
import { NavLink } from 'react-router-dom'

/** The ecosystem's shared header (@conways/drawer's AppHeader): back to where you came from in
 * Conway's Depot, the app and its tabs, and the "viewing as" user menu. */
export default function Nav() {
  return (
    <AppHeader
      brand={
        <NavLink to="/about" className="ch-brand">
          The Fixer
        </NavLink>
      }
    >
      <NavLink to="/" end className={({ isActive }) => tabClass(isActive)}>
        Cases
      </NavLink>
    </AppHeader>
  )
}
