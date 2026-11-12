// Google results in Find: the query we send, and how a result relates to the approved (nidirect) list. Pure.

import type { PlaceResult } from '../lib/places'
import type { SupplierCategory } from '../types'
import { CATEGORIES } from './categories'
import { DIRECTORY, haversineKm, HOME_BASE, type DirectoryVenue } from './venues'

/** "wedding photographer near Antrim, Northern Ireland" — the couple's own words replace the category's. */
export function googleQuery(category: SupplierCategory, area: string, q = ''): string {
  const what = q.trim() || CATEGORIES.find((c) => c.id === category)?.search || 'wedding supplier'
  const where = area.trim() || 'Northern Ireland'
  const full = /wedding/i.test(what) || category === 'other' ? what : `wedding ${what}`
  return `${full} near ${where}${/northern ireland|\bNI\b/i.test(where) ? '' : ', Northern Ireland'}`.slice(0, 160)
}

const STOP = /\b(the|hotel|house|resort|spa|golf|club|and|&|ltd|limited|venue|weddings?|restaurant|bar|inn|at|of)\b/g
export const normName = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(STOP, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * The approved-list venue a Google result is, if any: same core name, and either within 2 km or
 * (when either side has no pin) the same town in the address.
 */
export function approvedMatch(r: Pick<PlaceResult, 'name' | 'address' | 'lat' | 'lng'>, list: DirectoryVenue[] = DIRECTORY): DirectoryVenue | null {
  const n = normName(r.name)
  if (!n) return null
  for (const v of list) {
    const vn = normName(v.name)
    if (!vn || (vn !== n && !(n.length > 5 && vn.includes(n)) && !(vn.length > 5 && n.includes(vn)))) continue
    if (r.lat != null && r.lng != null && v.lat != null && v.lng != null) {
      if (haversineKm({ lat: r.lat, lng: r.lng }, { lat: v.lat, lng: v.lng }) <= 2) return v
      continue
    }
    if (v.town && (r.address ?? '').toLowerCase().includes(v.town.toLowerCase())) return v
  }
  return null
}

export function resultKm(r: Pick<PlaceResult, 'lat' | 'lng'>): number | null {
  return r.lat == null || r.lng == null ? null : haversineKm(HOME_BASE, { lat: r.lat, lng: r.lng })
}

/** A short "town" for a saved supplier, from Google's formatted address ("12 Main St, Antrim BT41 1AA"). */
export function townFromAddress(address = ''): string {
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean)
  const last = parts.filter((p) => !/^(uk|united kingdom|northern ireland)$/i.test(p)).at(-1) ?? ''
  return last.replace(/\s*\bBT\d{1,2}\s*\d[A-Z]{2}\b/i, '').trim()
}
