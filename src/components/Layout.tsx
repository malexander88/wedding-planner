import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useStore } from '../state/store'
import {
  IconBudget,
  IconGear,
  IconGuests,
  IconHome,
  IconHomeFill,
  IconPlan,
  IconSearch,
} from './Icons'

const mainNav = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/plan', label: 'Plan', icon: 'plan' },
  { to: '/find', label: 'Find', icon: 'find' },
  { to: '/budget', label: 'Budget', icon: 'budget' },
  { to: '/guests', label: 'Guests', icon: 'guests' },
] as const

// Pages that aren't built yet stay out of the nav (phone and desktop alike) until they are.
const moreNav = [
  { to: '/dates', label: 'Dates' },
  { to: '/settings', label: 'Settings & backup' },
]

function NavGlyph({ name, filled }: { name: (typeof mainNav)[number]['icon']; filled?: boolean }) {
  if (name === 'home') return filled ? <IconHomeFill /> : <IconHome />
  if (name === 'plan') return <IconPlan />
  if (name === 'find') return <IconSearch />
  if (name === 'budget') return <IconBudget />
  return <IconGuests />
}

export function Layout() {
  const { state } = useStore()
  const { pathname } = useLocation()
  // A new page starts at the top (otherwise opening a supplier lands half-way down).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  // Router links to "/" come out as /wedding-planner (no slash); keep the canonical /wedding-planner/
  // so a refresh or a shared link always hits the real index.html.
  useEffect(() => {
    const base = import.meta.env.BASE_URL
    if (base.length > 1 && window.location.pathname === base.slice(0, -1))
      window.history.replaceState(window.history.state, '', base + window.location.search + window.location.hash)
  }, [pathname])
  const names = [state.profile.partnerAName, state.profile.partnerBName].filter(Boolean).join(' & ')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <div className="brand-mark">W</div>
          <div>
            <div className="brand-name">Wedding Planner</div>
            <small>{names || 'Your wedding'}</small>
          </div>
        </NavLink>
        {mainNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <NavGlyph name={n.icon} filled />
            {n.label}
          </NavLink>
        ))}
        <div className="nav-section">More</div>
        {moreNav.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {n.label}
          </NavLink>
        ))}
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark">W</div>
            <div className="brand-name">Wedding Planner</div>
          </div>
          <NavLink to="/settings" className="icon-btn" aria-label="Settings">
            <IconGear />
          </NavLink>
        </div>
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {mainNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            {({ isActive }) => (
              <>
                <NavGlyph name={n.icon} filled={isActive && n.icon === 'home'} />
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
