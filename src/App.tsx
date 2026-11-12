import { VenueCompare } from './screens/VenueCompare'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Budget } from './screens/Budget'
import { Checklist } from './screens/Checklist'
import { Dates } from './screens/Dates'
import { Guests } from './screens/Guests'
import { Home } from './screens/Home'
import { Onboarding } from './screens/Onboarding'
import { Settings } from './screens/Settings'
import { SupplierDetail } from './screens/SupplierDetail'
import { VenueDetail } from './screens/VenueDetail'
import { Suppliers } from './screens/Suppliers'
import { JoinPrompt } from './components/JoinPrompt'
import { StoreProvider, useStore } from './state/store'
import { SyncProvider, useSync } from './sync/SyncProvider'

function ReadyApp() {
  const { state, ready, loadStatus } = useStore()
  const { joining } = useSync()
  if (loadStatus === 'error') {
    return (
      <div className="loading">
        <div style={{ maxWidth: 340, textAlign: 'center' }}>
          <div className="brand-mark" style={{ width: 52, height: 52, borderRadius: 16, fontSize: '1.6rem', margin: '0 auto 14px' }}>W</div>
          <h2>Couldn’t open your saved plan</h2>
          <p>Nothing has been changed or deleted. Close other tabs or windows with the planner open, then try again.</p>
          <button className="btn" type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    )
  }
  if (!ready || (joining && !state.profile.onboardingComplete)) {
    return (
      <div className="loading">
        <div>
          <div className="brand-mark" style={{ width: 52, height: 52, borderRadius: 16, fontSize: '1.6rem', margin: '0 auto 14px' }}>W</div>
          <p>{joining ? 'Joining your shared plan…' : 'Loading your wedding…'}</p>
        </div>
      </div>
    )
  }
  if (!state.profile.onboardingComplete) {
    return (
      <>
        <Onboarding />
        <JoinPrompt />
      </>
    )
  }
  return (
    <>
    <JoinPrompt />
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/plan" element={<Checklist />} />
        <Route path="/dates" element={<Dates />} />
        <Route path="/find" element={<Suppliers />} />
        <Route path="/find/compare" element={<VenueCompare />} />
        <Route path="/find/place/:venueId" element={<VenueDetail />} />
        <Route path="/find/:id" element={<SupplierDetail />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/guests" element={<Guests />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </>
  )
}

export default function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '')
  return (
    <StoreProvider>
      <SyncProvider>
        <BrowserRouter basename={basename || undefined}>
          <ReadyApp />
        </BrowserRouter>
      </SyncProvider>
    </StoreProvider>
  )
}
