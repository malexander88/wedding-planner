import { NavLink, Outlet } from 'react-router-dom'
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

function NavGlyph({ name, filled }: { name: (typeof mainNav)[number]['icon']; filled?: boolean }) {
  if (name === 'home') return filled ? <IconHomeFill /> : <IconHome />
  if (name === 'plan') return <IconPlan />
  if (name === 'find') return <IconSearch />
  if (name === 'budget') return <IconBudget />
  return <IconGuests />
}

export function Layout() {
  const { state } = useStore()
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
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link${n.soon ? ' soon' : ''}${isActive ? ' active' : ''}`}>
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
