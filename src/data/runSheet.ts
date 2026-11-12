// Wedding-day run sheet helpers. Pure.
// Defaults are generic, editable steps timed from the ceremony. They never invent supplier names,
// phone numbers or arrival times: rows for booked suppliers come from the couple's own bookings.

import type { AppState, RunSheetItem, SupplierCategory } from '../types'
import { categoryLabel } from './categories'

export const CEREMONY_ID = 'ev_ceremony'
export const EVENING_ID = 'ev_evening'

export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h < 24 && min < 60 ? h * 60 + min : null
}

export function fromMinutes(n: number): string {
  const d = ((Math.round(n) % 1440) + 1440) % 1440
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`
}

export function addMinutes(hhmm: string, delta: number): string {
  const m = toMinutes(hhmm)
  return m === null ? hhmm : fromMinutes(m + delta)
}

export function eventStart(state: Pick<AppState, 'events'>, id: string): string {
  return state.events.find((e) => e.id === id)?.start ?? ''
}

interface Step {
  slug: string
  at: number
  title: string
  owner: string
  notes?: string
}

/** Generic steps relative to the ceremony (minutes). Owners are roles, not names. */
const STEPS: Step[] = [
  { slug: 'prep', at: -240, title: 'Hair and make-up start', owner: 'Wedding party', notes: 'Adjust to suit how many people are getting ready.' },
  { slug: 'dressed', at: -75, title: 'Get dressed', owner: 'Couple' },
  { slug: 'leave', at: -45, title: 'Leave for the ceremony', owner: 'Couple', notes: 'Allow for travel time and parking.' },
  { slug: 'guests', at: -30, title: 'Guests arrive and are seated', owner: 'Ushers' },
  { slug: 'registrar', at: -15, title: 'Registrar or officiant meets you both', owner: 'Couple', notes: 'At a civil ceremony the registrar usually speaks to each of you before it starts.' },
  { slug: 'ceremony', at: 0, title: 'Ceremony', owner: 'Everyone' },
  { slug: 'confetti', at: 30, title: 'Confetti and group photos', owner: 'Photographer / ushers' },
  { slug: 'drinks', at: 45, title: 'Drinks reception', owner: 'Venue' },
  { slug: 'call', at: 135, title: 'Call to dinner', owner: 'Venue / MC' },
  { slug: 'meal', at: 150, title: 'Wedding breakfast', owner: 'Venue' },
  { slug: 'speeches', at: 255, title: 'Speeches', owner: 'Speakers', notes: 'Some couples do these before the meal instead.' },
  { slug: 'cake', at: 285, title: 'Cut the cake', owner: 'Couple' },
]

const EVENING_STEPS: Step[] = [
  { slug: 'evening', at: 0, title: 'Evening guests arrive', owner: 'Venue' },
  { slug: 'dance', at: 30, title: 'First dance', owner: 'Couple / band or DJ' },
  { slug: 'supper', at: 120, title: 'Evening food', owner: 'Venue' },
]

/** Deterministic ids: both phones generating defaults end up with the same rows, not duplicates. */
export const defaultId = (slug: string) => `rs-d-${slug}`

export function defaultRunSheet(opts: { ceremony: string; evening?: string; sunset?: string | null }): RunSheetItem[] {
  const c = toMinutes(opts.ceremony)
  if (c === null) return []
  const items: RunSheetItem[] = STEPS.map((s) => ({ id: defaultId(s.slug), time: fromMinutes(c + s.at), title: s.title, owner: s.owner, notes: s.notes ?? '' }))
  const e = toMinutes(opts.evening ?? '') ?? c + 360
  for (const s of EVENING_STEPS) items.push({ id: defaultId(s.slug), time: fromMinutes(e + s.at), title: s.title, owner: s.owner, notes: s.notes ?? '' })
  const sun = toMinutes(opts.sunset ?? '')
  if (sun !== null && sun > c + 60)
    items.push({ id: defaultId('golden'), time: fromMinutes(sun - 45), title: 'Golden-hour photos', owner: 'Couple / photographer', notes: `Sunset is usually about ${opts.sunset} on this date.` })
  items.push({ id: defaultId('carriages'), time: '', title: 'Carriages / last orders', owner: 'Venue', notes: 'Check your venue’s finish time.' })
  return sortRunSheet(items)
}

/** Add defaults without touching rows the couple already has (same id = keep theirs). */
export function withDefaults(existing: RunSheetItem[], defaults: RunSheetItem[]): RunSheetItem[] {
  const have = new Set(existing.map((x) => x.id))
  return sortRunSheet([...existing, ...defaults.filter((d) => !have.has(d.id))])
}

/** By time; rows without a time go last, in their saved order. */
export function sortRunSheet(items: RunSheetItem[]): RunSheetItem[] {
  return items
    .map((x, i) => ({ x, i, m: toMinutes(x.time) }))
    .sort((a, b) => (a.m === null ? 1 : 0) - (b.m === null ? 1 : 0) || (a.m ?? 0) - (b.m ?? 0) || a.i - b.i)
    .map((r) => r.x)
}

/** Move every timed row by `delta` minutes (used when the ceremony time changes). */
export function shiftRunSheet(items: RunSheetItem[], delta: number): RunSheetItem[] {
  // Golden hour follows the sun, not the ceremony.
  return items.map((x) => (toMinutes(x.time) === null || x.id === defaultId('golden') ? x : { ...x, time: addMinutes(x.time, delta) }))
}

export interface Contact {
  key: string
  name: string
  category: string
  contact: string
  phone: string
  email: string
  supplierId?: string
}

/** Contacts for the day: booked suppliers, plus booking details saved on checklist tasks. */
export function dayContacts(state: Pick<AppState, 'suppliers' | 'taskDetails'>): Contact[] {
  const out = new Map<string, Contact>()
  const key = (name: string) => name.trim().toLowerCase()
  for (const s of state.suppliers) {
    if (s.status !== 'booked') continue
    out.set(key(s.name), { key: s.id, name: s.name, category: categoryLabel(s.category), contact: '', phone: s.phone ?? '', email: s.email ?? '', supplierId: s.id })
  }
  for (const d of state.taskDetails) {
    if (d.template !== 'booking') continue
    const v = d.values ?? {}
    const sup = d.supplierId ? state.suppliers.find((s) => s.id === d.supplierId) : undefined
    const name = (v.supplierName || sup?.name || '').trim()
    if (!name) continue
    const cur = out.get(key(name))
    const merged: Contact = {
      key: cur?.key ?? d.id,
      name,
      category: cur?.category || (v.category ? categoryLabel(v.category as SupplierCategory) : 'Supplier'),
      contact: (v.contactName || cur?.contact || '').trim(),
      phone: (v.phone || cur?.phone || '').trim(),
      email: (v.email || cur?.email || '').trim(),
      supplierId: cur?.supplierId ?? sup?.id,
    }
    out.set(key(name), merged)
  }
  return [...out.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}
