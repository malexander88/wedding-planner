import type { AppState, Supplier } from '../types'
import { lineCost } from './budget'
import { feeForDate } from './legal'
import { venueFee } from './venueFee'
import { directoryVenue, distanceKm, formatKm, HOME_BASE, venueTypeOne, type DirectoryVenue } from './venues'

export const MAX_COMPARE = 4

/** Venues that can be compared: on the shortlist and not ruled out. */
export const comparableVenues = (state: Pick<AppState, 'suppliers'>) => state.suppliers.filter((s) => s.category === 'venue' && s.status !== 'rejected')

/** Which venues to show: the ones in the link (in that order, max 4), else the first three on the shortlist. */
export function pickCompare(all: Supplier[], ids: string[]): Supplier[] {
  const byId = new Map(all.map((s) => [s.id, s]))
  const chosen = [...new Set(ids)].map((id) => byId.get(id)).filter((s): s is Supplier => !!s)
  return (chosen.length ? chosen : all.slice(0, 3)).slice(0, MAX_COMPARE)
}

export interface CompareColumn {
  s: Supplier
  dir?: DirectoryVenue
  type: string
  capacity: number | null
  fitsGuests: boolean | null
  distance: string
  /** Official registrar fee band (always £). */
  fee: { weekday: number | null; saturday: number | null; onDate: number | null; label: string }
  /** What the couple has noted: the booked price, else the latest quote (plan currency). */
  price: { amount: number; kind: 'booked' | 'quote' } | null
  availability: 'unknown' | 'available' | 'unavailable' | 'hold' | null
  notes: string
}

export function compareColumn(state: AppState, s: Supplier): CompareColumn {
  const dir = s.catalogueId ? directoryVenue(s.catalogueId) : undefined
  const fee = venueFee(s)
  const guests = state.profile.estimatedDayGuests
  const capacity = dir?.capacity ?? null
  const date = state.profile.date
  const onDate = date && fee.band ? feeForDate(date, fee.band).amount : null
  const booked = state.budgetLines.filter((l) => l.supplierId === s.id).reduce((n, l) => n + lineCost(l), 0)
  const quotes = state.quotes.filter((q) => q.supplierId === s.id && q.amount > 0).sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || ''))
  const km = dir ? distanceKm(dir) : null
  return {
    s,
    dir,
    type: dir ? venueTypeOne(dir.type) : 'Venue',
    capacity,
    fitsGuests: capacity && guests ? capacity >= guests : null,
    distance: km === null ? '' : `${formatKm(km)} from ${HOME_BASE.label}`,
    fee: { weekday: fee.band?.weekday ?? null, saturday: fee.band?.saturday ?? null, onDate: onDate ?? null, label: fee.label },
    price: booked > 0 ? { amount: booked, kind: 'booked' } : quotes[0] ? { amount: quotes[0].amount, kind: 'quote' } : null,
    availability: date ? ((state.venueDates.find((x) => x.supplierId === s.id && x.date === date)?.availability ?? 'unknown') as CompareColumn['availability']) : null,
    notes: s.notes.trim(),
  }
}
