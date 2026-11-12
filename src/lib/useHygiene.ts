import { useEffect, useState } from 'react'
import { directoryVenue, type DirectoryVenue } from '../data/venues'
import type { Supplier } from '../types'
import { cachedHygiene, lookupHygiene, type HygieneQuery, type HygieneResult } from './hygiene'

export function venueQuery(v: Pick<DirectoryVenue, 'name' | 'town' | 'postcode' | 'lat' | 'lng' | 'geo'>): HygieneQuery {
  return { name: v.name, town: v.town, postcode: v.postcode, lat: v.lat, lng: v.lng, precise: v.geo === 'place' || v.geo === 'postcode' }
}

/** Venues and caterers get a hygiene lookup; other suppliers don't handle food. */
export function supplierQuery(s: Pick<Supplier, 'name' | 'area' | 'category' | 'catalogueId'>): HygieneQuery | null {
  if (s.category !== 'venue' && s.category !== 'catering') return null
  const d = s.catalogueId ? directoryVenue(s.catalogueId) : undefined
  if (d) return venueQuery(d)
  const town = s.area.split(/[,·]/)[0].trim()
  return { name: s.name, town: town && !/northern ireland|ni-wide|anywhere/i.test(town) ? town : undefined }
}

export type HygieneState = HygieneResult | { status: 'loading' }

export function useHygiene(q: HygieneQuery | null): HygieneState | null {
  const key = q ? JSON.stringify(q) : ''
  const [res, setRes] = useState<{ key: string; r: HygieneResult } | null>(null)
  useEffect(() => {
    if (!key) return
    const query = JSON.parse(key) as HygieneQuery
    if (cachedHygiene(query)) return
    let live = true
    lookupHygiene(query).then((r) => live && setRes({ key, r }))
    return () => {
      live = false
    }
  }, [key])
  if (!q) return null
  if (res?.key === key) return res.r
  return cachedHygiene(q) ?? { status: 'loading' }
}
