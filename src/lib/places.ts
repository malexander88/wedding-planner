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
  hours?: { openNow?: boolean; days: string[] }
  photo?: { url: string; attributions: { name: string; uri?: string }[] }
}

/** One Google search result (Text Search Pro fields only: no photo or rating until it's opened). */
export interface PlaceResult {
  id: string
  name: string
  address?: string
  mapsUrl?: string
  closed?: boolean
  type?: string
  lat?: number
  lng?: number
}

/**
 * Why Google results aren't showing: switched off in this build, today's cap used up, the function down
 * or unreachable, or an older function that doesn't know this request yet.
 */
export type PlacesProblem = 'off' | 'limit' | 'down' | 'unsupported'
export type PlacesResult<T> = { ok: true; data: T } | { ok: false; problem: PlacesProblem }

export const placesEnabled = () => PLACES_ENABLED

// Session-only cache so flipping between pages doesn't spend quota twice. Never persisted; failures aren't cached.
const cache = new Map<string, Promise<PlacesResult<unknown>>>()

export function problemFor(status: number, body: unknown): PlacesProblem {
  if (status === 429) return 'limit'
  if (status === 400 && (body as { error?: string } | null)?.error === 'op') return 'unsupported'
  return 'down'
}

async function request<T>(body: Record<string, string>, fetcher: typeof fetch = fetch): Promise<PlacesResult<T>> {
  if (!PLACES_ENABLED) return { ok: false, problem: 'off' }
  const key = JSON.stringify(body)
  const hit = cache.get(key)
  if (hit) return hit as Promise<PlacesResult<T>>
  const p: Promise<PlacesResult<T>> = fetcher(PLACES_FUNCTION_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: key,
  })
    .then(async (r) => {
      const json = await r.json().catch(() => null)
      if (r.ok && json) return { ok: true as const, data: json as T }
      return { ok: false as const, problem: problemFor(r.status, json) }
    })
    .catch(() => ({ ok: false as const, problem: 'down' as const }))
  cache.set(key, p)
  p.then((r) => {
    if (!r.ok) cache.delete(key)
  })
  return p
}

/** For tests: forget the session cache. */
export const clearPlacesCache = () => {
  cache.clear()
  photos.clear()
  ratings.clear()
}

/** Free "IDs only" text search: the best-matching place_id for a venue, or null. */
export async function findPlaceId(name: string, town: string): Promise<string | null> {
  const r = await request<{ id: string | null }>({ op: 'find', query: `${name}, ${town || 'Northern Ireland'}` })
  return r.ok ? r.data.id : null
}

/** Fresh details for a place_id (refreshed every time a page opens; not stored). */
export async function placeDetails(placeId: string): Promise<PlaceDetails | null> {
  const r = await fetchPlaceDetails(placeId)
  return r.ok ? r.data : null
}
export function fetchPlaceDetails(placeId: string): Promise<PlacesResult<PlaceDetails>> {
  return request<PlaceDetails>({ op: 'details', id: placeId }).then((r) => {
    if (r.ok) rememberDetails(`place:${placeId}`, r.data)
    return r
  })
}

// Photos already loaded this session (a place was opened), so cards can show them without another call.
// Memory only: Google photo links are short-lived and mustn't be stored.
const photos = new Map<string, NonNullable<PlaceDetails['photo']>>()
export const venuePhotoKey = (name: string, town: string) => `venue:${name.toLowerCase().trim()}|${town.toLowerCase().trim()}`
export function rememberPhoto(key: string, photo: NonNullable<PlaceDetails['photo']>) {
  photos.set(key, photo)
}
/** A Google photo for `place:<id>` or a venuePhotoKey(), if one was loaded this session; never fetches. */
export function sessionPhoto(key: string | null | undefined): NonNullable<PlaceDetails['photo']> | null {
  return (key && photos.get(key)) || null
}

// Ratings already loaded this session (same rule: only from a place someone opened; memory only).
const ratings = new Map<string, { rating: number; count?: number }>()
/** Remember what a details call returned (photo and rating) for cards and the compare table. */
export function rememberDetails(key: string, d: PlaceDetails) {
  if (d.photo) rememberPhoto(key, d.photo)
  if (typeof d.rating === 'number') ratings.set(key, { rating: d.rating, count: d.ratingCount })
}
/** A Google rating for `place:<id>` or a venuePhotoKey(), if a details call already returned one this session. */
export function sessionRating(...keys: (string | null | undefined)[]): { rating: number; count?: number } | null {
  for (const k of keys) {
    const r = k && ratings.get(k)
    if (r) return r
  }
  return null
}

/** Google Text Search within Northern Ireland: one call, up to 12 places. */
export async function searchPlaces(query: string): Promise<PlacesResult<PlaceResult[]>> {
  const r = await request<{ results: PlaceResult[] }>({ op: 'search', query: query.trim().slice(0, 160) })
  return r.ok ? { ok: true, data: r.data.results ?? [] } : r
}

export function problemText(p: PlacesProblem): string {
  switch (p) {
    case 'limit':
      return 'Google results have reached today’s limit (it keeps this app free). They’ll be back tomorrow — the approved list and web search buttons still work.'
    case 'unsupported':
      return 'Google search isn’t switched on for this app yet. The approved list and web search buttons still work.'
    case 'off':
      return 'Google results are switched off in this version.'
    default:
      return 'Couldn’t reach Google just now. Try again in a minute — the approved list and web search buttons still work.'
  }
}
