import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../state/store'

const mainNav = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/plan', label: 'Plan', icon: '✓' },
  { to: '/find', label: 'Find', icon: '⌕' },
  { to: '/budget', label: 'Budget', icon: '£' },
  { to: '/guests', label: 'Guests', icon: '☺' },
]

const moreNav = [
  { to: '/dates', label: 'Dates' },
  { to: '/settings', label: 'Settings & backup' },
  { to: '/rsvp', label: 'RSVP site', soon: true },
  { to: '/seating', label: 'Seating', soon: true },
  { to: '/run-sheet', label: 'Run sheet', soon: true },
  { to: '/gifts', label: 'Gifts & thank-yous', soon: true },
  { to: '/mood', label: 'Mood board', soon: true },
  { to: '/helpers', label: 'Helpers', soon: true },
]

export function Layout() {
  const { state } = useStore()
  const names = [state.profile.partnerAName, state.profile.partnerBName].filter(Boolean).join(' & ')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <div className="brand-mark">W</div>
          <div>
            <strong>Wedding Planner</strong>
            <small>{names || 'Your wedding'}</small>
          </div>
        </NavLink>
        {mainNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span>{n.icon}</span> {n.label}
          </NavLink>
        ))}
        <div className="nav-section">More</div>
        {moreNav.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link${n.soon ? ' soon' : ''}${isActive ? ' active' : ''}`}>
            {n.label}
          </NavLink>
        ))}
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <div className="kicker">Wedding Planner</div>
            <div className="names">{names || 'Add your names in settings'}</div>
          </div>
          <div className="btn-row">
            <NavLink to="/dates" className="btn ghost small">Dates</NavLink>
            <NavLink to="/settings" className="btn ghost small">Backup</NavLink>
          </div>
        </div>
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {mainNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
