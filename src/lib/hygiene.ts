// Food hygiene ratings from the Food Standards Agency's public FHRS API (no key; Open Government Licence).
// Shown for venues and caterers when we can find a confident match: a food business near the venue's pin
// (or in Northern Ireland, for caterers) whose name shares the distinctive words. The matched name and
// address are always shown so the couple can tell if it's the wrong place.

export interface HygieneQuery {
  name: string
  town?: string
  postcode?: string
  lat?: number | null
  lng?: number | null
  /** How exact the pin is ('place' or 'postcode' allow a tight radius). */
  precise?: boolean
}

export interface Establishment {
  FHRSID: number
  BusinessName: string
  BusinessType: string
  AddressLine1?: string
  AddressLine2?: string
  AddressLine3?: string
  AddressLine4?: string
  PostCode?: string
  RatingValue: string
  RatingDate?: string
  LocalAuthorityName?: string
  NewRatingPending?: boolean
  Distance?: number | null
}

export interface HygieneMatch {
  id: number
  name: string
  address: string
  rating: string
  ratedOn: string
  authority: string
  pending: boolean
  url: string
}

export type HygieneResult = { status: 'match'; match: HygieneMatch } | { status: 'none' } | { status: 'error' }

const FOOD_TYPES: Record<string, number> = {
  'Hotel/bed & breakfast/guest house': 3,
  'Restaurant/Cafe/Canteen': 2,
  'Other catering premises': 2,
  'Pub/bar/nightclub': 2,
  'Mobile caterer': 2,
  'Takeaway/sandwich shop': 1,
}
const STOP = new Set(
  'the and of at a an hotel house restaurant ltd limited co company resort spa golf club country estate castle venue venues lodge park hall centre center museum suite suites catering caterers cater events event weddings wedding bar kitchen ni'.split(
    ' ',
  ),
)
const words = (s: string) => s.toLowerCase().replace(/&/g, ' ').match(/[a-z0-9]+/g) ?? []
export const keyWords = (name: string) => {
  const w = words(name).filter((x) => !STOP.has(x))
  return w.length ? w : words(name)
}
const compactPc = (p?: string) => (p ?? '').replace(/\s/g, '').toUpperCase()

export const RATING_TEXT: Record<string, string> = {
  '5': 'Very good',
  '4': 'Good',
  '3': 'Generally satisfactory',
  '2': 'Improvement necessary',
  '1': 'Major improvement necessary',
  '0': 'Urgent improvement necessary',
  AwaitingInspection: 'Awaiting inspection',
  AwaitingPublication: 'Rating awaiting publication',
  Exempt: 'Exempt from rating',
}

/** Pick the confident match from FHRS results, or null. */
export function bestMatch(q: HygieneQuery, list: Establishment[]): Establishment | null {
  const want = keyWords(q.name)
  const hasPin = q.lat !== null && q.lat !== undefined && q.lng !== null && q.lng !== undefined
  const maxMiles = q.precise ? 0.3 : 1
  const town = (q.town ?? '').toLowerCase()
  let best: { score: number; e: Establishment } | null = null
  for (const e of list) {
    const typeScore = FOOD_TYPES[e.BusinessType]
    if (!typeScore) continue
    const have = new Set(words(e.BusinessName))
    const overlap = want.filter((w) => have.has(w)).length / want.length
    if (overlap < 0.5) continue
    const samePc = !!q.postcode && compactPc(e.PostCode) === compactPc(q.postcode)
    if (hasPin) {
      if (e.Distance !== null && e.Distance !== undefined && !samePc && e.Distance > maxMiles) continue
    } else {
      // Caterers: Northern Ireland only (BT postcodes); a town match helps.
      if (!compactPc(e.PostCode).startsWith('BT')) continue
    }
    const addr = [e.AddressLine1, e.AddressLine2, e.AddressLine3, e.AddressLine4].join(' ').toLowerCase()
    const score = overlap * 10 + typeScore + (samePc ? 3 : 0) + (town && addr.includes(town) ? 2 : 0) - (e.Distance ?? 0)
    if (!best || score > best.score) best = { score, e }
  }
  // Without a pin, insist on a strong name match.
  if (best && !hasPin && keyWords(best.e.BusinessName).filter((w) => want.includes(w)).length / want.length < 0.67) return null
  return best?.e ?? null
}

export function toMatch(e: Establishment): HygieneMatch {
  return {
    id: e.FHRSID,
    name: e.BusinessName,
    address: [e.AddressLine1, e.AddressLine2, e.AddressLine3, e.PostCode].filter(Boolean).join(', '),
    rating: e.RatingValue,
    ratedOn: (e.RatingDate ?? '').slice(0, 10).startsWith('19') ? '' : (e.RatingDate ?? '').slice(0, 10),
    authority: e.LocalAuthorityName ?? '',
    pending: !!e.NewRatingPending,
    url: `https://ratings.food.gov.uk/business/${e.FHRSID}`,
  }
}

export function searchUrl(q: HygieneQuery): string {
  const p = new URLSearchParams({ name: keyWords(q.name).sort((a, b) => b.length - a.length)[0] ?? q.name, pageSize: '30' })
  if (q.lat !== null && q.lat !== undefined && q.lng !== null && q.lng !== undefined) {
    p.set('latitude', String(q.lat))
    p.set('longitude', String(q.lng))
    p.set('maxDistanceLimit', '1')
  } else if (q.town) {
    p.set('address', q.town)
  }
  return `https://api.ratings.food.gov.uk/Establishments?${p.toString()}`
}

const TTL = 14 * 86400000
const cacheKey = (q: HygieneQuery) => `wp.fhrs.v1|${q.name.toLowerCase().trim()}|${(q.town ?? '').toLowerCase().trim()}`
const inflight = new Map<string, Promise<HygieneResult>>()

export function cachedHygiene(q: HygieneQuery, now = Date.now()): HygieneResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(q))
    if (!raw) return null
    const v = JSON.parse(raw) as { at: number; r: HygieneResult }
    return now - v.at < TTL ? v.r : null
  } catch {
    return null
  }
}

export function lookupHygiene(q: HygieneQuery, fetcher: typeof fetch = fetch): Promise<HygieneResult> {
  const hit = cachedHygiene(q)
  if (hit) return Promise.resolve(hit)
  const key = cacheKey(q)
  const running = inflight.get(key)
  if (running) return running
  const p = fetcher(searchUrl(q), { headers: { 'x-api-version': '2', accept: 'application/json' } })
    .then(async (r): Promise<HygieneResult> => {
      if (!r.ok) return { status: 'error' }
      const j = (await r.json()) as { establishments?: Establishment[] }
      let e = bestMatch(q, j.establishments ?? [])
      // No pin and nothing in town: try once more across Northern Ireland by name alone.
      if (!e && !(q.lat !== null && q.lat !== undefined) && q.town) {
        const r2 = await fetcher(searchUrl({ ...q, town: undefined }), { headers: { 'x-api-version': '2', accept: 'application/json' } })
        if (r2.ok) e = bestMatch(q, ((await r2.json()) as { establishments?: Establishment[] }).establishments ?? [])
      }
      const res: HygieneResult = e ? { status: 'match', match: toMatch(e) } : { status: 'none' }
      try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), r: res }))
        // Keep the cache small: drop the oldest beyond 60 entries.
        const keys: { k: string; at: number }[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k?.startsWith('wp.fhrs.')) keys.push({ k, at: JSON.parse(localStorage.getItem(k) ?? '{"at":0}').at ?? 0 })
        }
        keys.sort((a, b) => b.at - a.at).slice(60).forEach(({ k }) => localStorage.removeItem(k))
      } catch {
        /* ignore */
      }
      return res
    })
    .catch((): HygieneResult => ({ status: 'error' }))
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}
