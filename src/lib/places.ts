import { SUPABASE_ANON_KEY } from '../config/supabase'
import { PLACES_ENABLED, PLACES_FUNCTION_URL } from '../config/places'

/** What the Edge Function returns for one place. Nothing here is stored — only `id` (the place_id) may be kept. */
export interface PlaceDetails {
  id: string
  name: string
  address?: string
  phone?: string
  website?: string
  mapsUrl?: string
  /** Google lists it as permanently closed. */
  closed?: boolean
  rating?: number
  ratingCount?: number
  photo?: { url: string; attributions: { name: string; uri?: string }[] }
}

export const placesEnabled = () => PLACES_ENABLED

// Session-only cache so flipping between pages doesn't spend quota twice. Never persisted.
const cache = new Map<string, Promise<unknown>>()

async function call<T>(body: Record<string, string>): Promise<T | null> {
  if (!PLACES_ENABLED) return null
  const key = JSON.stringify(body)
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(PLACES_FUNCTION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: key,
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    )
  }
  return (await cache.get(key)) as T | null
}

/** Free "IDs only" text search: the best-matching place_id for a venue, or null. */
export async function findPlaceId(name: string, town: string): Promise<string | null> {
  const r = await call<{ id: string | null }>({ op: 'find', query: `${name}, ${town || 'Northern Ireland'}` })
  return r?.id ?? null
}

/** Fresh details for a place_id (refreshed every time a page opens; not stored). */
export async function placeDetails(placeId: string): Promise<PlaceDetails | null> {
  return call<PlaceDetails>({ op: 'details', id: placeId })
}
