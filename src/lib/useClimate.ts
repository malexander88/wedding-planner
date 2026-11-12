import { useEffect, useState } from 'react'
import { directoryVenue, HOME_BASE } from '../data/venues'
import type { AppState } from '../types'
import { cachedClimate, loadClimate, type ClimateSummary } from './climate'

/** Where to take the weather history from: the chosen venue, else the first shortlisted venue with a pin, else home. */
export function climatePlace(state: Pick<AppState, 'profile' | 'suppliers'>): { lat: number; lng: number; label: string } {
  const venues = state.suppliers.filter((s) => s.category === 'venue' && s.status !== 'rejected')
  const chosen = venues.find((s) => s.id === state.profile.venueSupplierId)
  for (const s of [chosen, ...venues]) {
    const d = s?.catalogueId ? directoryVenue(s.catalogueId) : undefined
    if (d && d.lat !== null && d.lng !== null) return { lat: d.lat, lng: d.lng, label: d.name }
  }
  return { lat: HOME_BASE.lat, lng: HOME_BASE.lng, label: HOME_BASE.label }
}

export type ClimateState = { status: 'loading' | 'off' } | { status: 'ok'; data: ClimateSummary }

export function useClimate(lat: number, lng: number): ClimateState {
  const key = `${lat},${lng}`
  const [res, setRes] = useState<{ key: string; s: ClimateState } | null>(null)
  useEffect(() => {
    if (cachedClimate(lat, lng)) return
    let live = true
    loadClimate(lat, lng).then((d) => live && setRes({ key: `${lat},${lng}`, s: d ? { status: 'ok', data: d } : { status: 'off' } }))
    return () => {
      live = false
    }
  }, [lat, lng])
  const hit = cachedClimate(lat, lng)
  if (hit) return { status: 'ok', data: hit }
  return res?.key === key ? res.s : { status: 'loading' }
}
