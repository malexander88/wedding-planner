// Google Places (New) proxy for the Wedding Planner (see PLAN.md, "Google Places").
//
// Why a proxy: the Google key must never reach the browser. The app sends { op, ... } here with its public
// publishable key; this function adds the Google key, applies a tight field mask, and enforces per-day caps
// (counted in public.places_usage via the places_bump() function, which only the service role may call).
//
// Ops
//   { op: 'find', query }  -> { id }          Text Search, field mask `places.id` (Essentials IDs Only SKU, free)
//   { op: 'search', query } -> { results }    Text Search Pro: up to 12 places in Northern Ireland with name,
//                                             address, type and Maps link (no photos, no ratings: those cost more)
//   { op: 'details', id }  -> PlaceDetails    Place Details, Pro mask (+ Enterprise fields only if PLACES_TIER=enterprise)
//                                             + one photo (Place Details Photos SKU) if under the photo cap
// Nothing is stored here except daily counts. The app keeps only the place id and re-fetches details on open.
//
// Secrets (supabase secrets set ...): GOOGLE_PLACES_KEY, PLACES_CLIENT_KEY (the app's publishable key).
// Optional: PLACES_TIER=pro|enterprise, PLACES_CAP_FIND, PLACES_CAP_DETAILS, PLACES_CAP_PHOTOS, PLACES_ALLOWED_ORIGINS.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the Edge runtime; they never leave the server.

const env = (k: string, d = '') => Deno.env.get(k) ?? d
const GOOGLE_KEY = env('GOOGLE_PLACES_KEY')
const CLIENT_KEY = env('PLACES_CLIENT_KEY')
const TIER = env('PLACES_TIER', 'pro')
// Daily caps, counted in Europe/London days. Worst case (every cap hit every day for 31 days) stays inside
// Google's free monthly usage per SKU: Text Search Pro 5,000; Place Details Enterprise 1,000; Photos 1,000.
const CAPS = {
  // Shared by 'find' (free IDs-only) and 'search' (Text Search Pro): 100/day -> at most 3,100 a month.
  find: Number(env('PLACES_CAP_FIND', '100')),
  // Pro details: 5,000 free a month -> 150/day stays under it. Enterprise: 1,000 free -> 30/day.
  details: Number(env('PLACES_CAP_DETAILS', TIER === 'enterprise' ? '30' : '150')),
  // Photos: 1,000 free a month -> 30/day.
  photos: Number(env('PLACES_CAP_PHOTOS', '30')),
}
const ORIGINS = env('PLACES_ALLOWED_ORIGINS', 'https://malexander88.github.io,http://localhost:5173,http://localhost:4177')
  .split(',')
  .map((s) => s.trim())

const PRO_FIELDS = ['id', 'displayName', 'formattedAddress', 'googleMapsUri', 'businessStatus', 'photos']
const ENTERPRISE_FIELDS = ['nationalPhoneNumber', 'websiteUri', 'rating', 'userRatingCount', 'regularOpeningHours']
const SEARCH_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.googleMapsUri',
  'places.businessStatus',
  'places.primaryTypeDisplayName',
  'places.location',
].join(',')
const DETAILS_MASK = [...PRO_FIELDS, ...(TIER === 'enterprise' ? ENTERPRISE_FIELDS : [])].join(',')
// Northern Ireland, so "The Old Courthouse" doesn't match one in England.
const NI = { low: { latitude: 54.0, longitude: -8.2 }, high: { latitude: 55.35, longitude: -5.4 } }

function cors(origin: string | null) {
  const allow = origin && ORIGINS.includes(origin) ? origin : ORIGINS[0]
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'Origin',
  }
}
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(origin) } })

/** Atomically count one call; false when today's cap is used up (or counting fails — fail closed). */
async function bump(sku: keyof typeof CAPS): Promise<boolean> {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/places_bump`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ p_sku: sku, p_cap: CAPS[sku] }),
  })
  return res.ok && (await res.json()) === true
}

async function google(path: string, init: RequestInit & { mask: string }) {
  const res = await fetch(`https://places.googleapis.com/v1/${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': init.mask },
  })
  if (!res.ok) throw new Error(`google ${res.status}`)
  return res.json()
}

const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })
  if (req.method !== 'POST') return json({ error: 'method' }, 405, origin)
  if (!GOOGLE_KEY) return json({ error: 'not configured' }, 503, origin)
  if (origin && !ORIGINS.includes(origin)) return json({ error: 'origin' }, 403, origin)
  if (!CLIENT_KEY || req.headers.get('apikey') !== CLIENT_KEY) return json({ error: 'key' }, 401, origin)

  let body: { op?: string; query?: string; id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body' }, 400, origin)
  }

  try {
    if (body.op === 'find') {
      const query = String(body.query ?? '').slice(0, 160).trim()
      if (!query) return json({ error: 'query' }, 400, origin)
      if (!(await bump('find'))) return json({ error: 'daily limit' }, 429, origin)
      const r = await google('places:searchText', {
        method: 'POST',
        mask: 'places.id',
        body: JSON.stringify({ textQuery: query, regionCode: 'GB', pageSize: 1, locationRestriction: { rectangle: NI } }),
      })
      return json({ id: r.places?.[0]?.id ?? null }, 200, origin)
    }

    if (body.op === 'search') {
      const query = String(body.query ?? '').slice(0, 160).trim()
      if (!query) return json({ error: 'query' }, 400, origin)
      if (!(await bump('find'))) return json({ error: 'daily limit' }, 429, origin)
      const r = await google('places:searchText', {
        method: 'POST',
        mask: SEARCH_MASK,
        body: JSON.stringify({ textQuery: query, regionCode: 'GB', languageCode: 'en-GB', pageSize: 12, locationRestriction: { rectangle: NI } }),
      })
      type P = {
        id: string
        displayName?: { text?: string }
        formattedAddress?: string
        googleMapsUri?: string
        businessStatus?: string
        primaryTypeDisplayName?: { text?: string }
        location?: { latitude: number; longitude: number }
      }
      const results = ((r.places ?? []) as P[]).map((p) => ({
        id: p.id,
        name: p.displayName?.text ?? '',
        address: p.formattedAddress,
        mapsUrl: p.googleMapsUri,
        closed: p.businessStatus === 'CLOSED_PERMANENTLY',
        type: p.primaryTypeDisplayName?.text,
        lat: p.location?.latitude,
        lng: p.location?.longitude,
      }))
      return json({ results }, 200, origin)
    }

    if (body.op === 'details') {
      const id = String(body.id ?? '')
      if (!PLACE_ID.test(id)) return json({ error: 'id' }, 400, origin)
      if (!(await bump('details'))) return json({ error: 'daily limit' }, 429, origin)
      const p = await google(`places/${id}?languageCode=en-GB&regionCode=GB`, { method: 'GET', mask: DETAILS_MASK })
      let photo: { url: string; attributions: { name: string; uri?: string }[] } | undefined
      const first = p.photos?.[0]
      if (first?.name && (await bump('photos'))) {
        // skipHttpRedirect returns a short-lived image URL that doesn't carry our key.
        const media = await google(`${first.name}/media?maxWidthPx=900&skipHttpRedirect=true`, { method: 'GET', mask: '*' })
        if (media.photoUri)
          photo = {
            url: media.photoUri,
            attributions: (first.authorAttributions ?? []).map((a: { displayName: string; uri?: string }) => ({ name: a.displayName, uri: a.uri })),
          }
      }
      return json(
        {
          id: p.id,
          name: p.displayName?.text ?? '',
          address: p.formattedAddress,
          mapsUrl: p.googleMapsUri,
          closed: p.businessStatus === 'CLOSED_PERMANENTLY',
          phone: p.nationalPhoneNumber,
          website: p.websiteUri,
          rating: p.rating,
          ratingCount: p.userRatingCount,
          hours: p.regularOpeningHours
            ? { openNow: p.regularOpeningHours.openNow, days: p.regularOpeningHours.weekdayDescriptions ?? [] }
            : undefined,
          photo,
        },
        200,
        origin,
      )
    }
    return json({ error: 'op' }, 400, origin)
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 502, origin)
  }
})
