// The in-app venue finder's directory: every place nidirect lists as approved
// for civil marriage / civil partnership, merged with the checked starter facts.
import type { CouncilId } from '../types'
import { CATALOGUE } from './catalogue'
import { COUNCILS } from './legal'
import data from './venues.generated.json'

export type VenueType =
  | 'hotel' | 'castle' | 'house' | 'estate' | 'barn' | 'club' | 'restaurant' | 'hall' | 'culture' | 'registrar' | 'other'

export const VENUE_TYPES: { id: VenueType; label: string; one: string }[] = [
  { id: 'hotel', label: 'Hotels', one: 'Hotel' },
  { id: 'castle', label: 'Castles', one: 'Castle' },
  { id: 'house', label: 'Country houses', one: 'Country house' },
  { id: 'estate', label: 'Gardens & estates', one: 'Garden or estate' },
  { id: 'barn', label: 'Barns & rural', one: 'Barn or rural venue' },
  { id: 'culture', label: 'Museums & landmarks', one: 'Museum or landmark' },
  { id: 'hall', label: 'Halls', one: 'Hall' },
  { id: 'restaurant', label: 'Restaurants & bars', one: 'Restaurant or bar' },
  { id: 'club', label: 'Golf & clubs', one: 'Golf or social club' },
  { id: 'registrar', label: 'Registrar offices', one: 'Registrar office' },
  { id: 'other', label: 'Other', one: 'Venue' },
]
export const venueTypeLabel = (t: VenueType) => VENUE_TYPES.find((x) => x.id === t)?.label ?? 'Other'
export const venueTypeOne = (t: VenueType) => VENUE_TYPES.find((x) => x.id === t)?.one ?? 'Venue'
/** "Town · Council", without repeating a town the council's name already contains. */
export function venuePlace(v: Pick<DirectoryVenue, 'town' | 'council'>) {
  const council = COUNCILS[v.council].short
  if (!v.town || council.toLowerCase().includes(v.town.toLowerCase())) return council
  return `${v.town} · ${council}`
}

export interface DirectoryVenue {
  id: string
  name: string
  town: string
  address: string
  postcode: string
  council: CouncilId
  phone: string
  kind: 'venue' | 'registrar'
  type: VenueType
  lat: number | null
  lng: number | null
  /** How precise the map pin is: the place itself, its street address ('postcode'), or just the town. */
  geo: 'place' | 'postcode' | 'town' | null
  /** On nidirect's approved list (or the council's own list for starter venues). */
  approved: boolean
  /** Largest guest number a checked source mentions. */
  capacity?: number
  website?: string
  /** Checked starter facts, with where they came from. */
  facts?: string
  factsSource?: { label: string; url: string }
  photo?: string
  /** True when the entry also carries checked starter-list facts. */
  checked: boolean
}

export const DIRECTORY_SOURCE = {
  url: data.source,
  label: 'nidirect: registration office venues for civil marriage and civil partnerships',
  pageUpdated: data.pageUpdated,
  checkedOn: data.checkedOn,
  licence: 'Contains public sector information licensed under the Open Government Licence v3.0.',
  licenceUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
}

/** Starter-list venue → nidirect entry. The starter id is kept so existing shortlists still match. */
const STARTER_MATCH: Record<string, string | null> = {
  'venue-antrim-civic': 'nid-anbc-registrars-office-antrim',
  'venue-ballyclare-town-hall': 'nid-ballyclare-town-hall-ballyclare',
  'venue-antrim-castle-gardens': 'nid-antrim-castle-gardens-clotworthy-house-antrim',
  'venue-old-courthouse': 'nid-old-courthouse-antrim',
  'venue-sentry-hill': 'nid-sentry-hill-newtownabbey',
  'venue-barnabys': 'nid-barnabys-ballyrobert',
  'venue-breckenhill': 'nid-breckenhill-ballyclare',
  'venue-corrs-corner': 'nid-corrs-corner-hotel-newtownabbey',
  'venue-dunsilly': 'nid-dunsilly-hotel-antrim',
  'venue-dunadry': 'nid-dunadry-hotel-antrim',
  'venue-hilton-templepatrick': 'nid-hilton-hotel-templepatrick',
  'venue-maldron': 'nid-maldron-hotel-at-belfast-international-airport',
  'venue-rabbit': 'nid-the-rabbit-hotel-templepatrick',
  'venue-shanes-castle': 'nid-shanes-castle-antrim',
  'venue-dunamoy': null, // on ANBC's own list, not (yet) on nidirect's
  'venue-malone-house': 'nid-malone-house-belfast',
  'venue-belfast-castle': 'nid-belfast-castle-belfast',
  'venue-titanic-hotel': 'nid-titanic-hotel-belfast',
}
const STARTER_TYPE: Record<string, VenueType> = {
  'venue-antrim-civic': 'hall',
  'venue-barnabys': 'restaurant',
  'venue-breckenhill': 'barn',
  'venue-dunamoy': 'house',
  'venue-sentry-hill': 'culture',
  'venue-old-courthouse': 'culture',
}

function capacityFrom(note = ''): number | undefined {
  const n = [...note.matchAll(/(?:up to|for up to|to about|seats up to|about)\s+(\d{2,4})/gi)].map((m) => Number(m[1]))
  return n.length ? Math.max(...n) : undefined
}

function build(): DirectoryVenue[] {
  const raw = data.venues as Omit<DirectoryVenue, 'approved' | 'checked'>[]
  const byId = new Map(raw.map((v) => [v.id, v]))
  const used = new Set<string>()
  const out: DirectoryVenue[] = []
  for (const c of CATALOGUE.filter((x) => x.category === 'venue')) {
    const nidId = STARTER_MATCH[c.id]
    const n = nidId ? byId.get(nidId) : undefined
    if (nidId) used.add(nidId)
    const fallbackTown = c.area.split(',')[0].trim()
    out.push({
      id: c.id,
      name: c.name,
      town: n?.town || fallbackTown,
      address: n?.address ?? '',
      postcode: n?.postcode ?? '',
      council: n?.council ?? 'anbc',
      phone: c.phone || n?.phone || '',
      kind: 'venue',
      type: STARTER_TYPE[c.id] ?? (n?.type === 'registrar' ? 'hall' : (n?.type as VenueType)) ?? 'other',
      lat: n?.lat ?? null,
      lng: n?.lng ?? null,
      geo: n?.geo ?? null,
      approved: true,
      capacity: capacityFrom(c.note),
      website: c.website,
      facts: c.note,
      factsSource: { label: c.source, url: c.sourceUrl },
      checked: true,
    })
  }
  for (const v of raw) {
    if (used.has(v.id)) continue
    out.push({ ...v, type: v.type as VenueType, approved: true, checked: false })
  }
  // Starter venues without their own pin borrow the town's from a neighbour in the list.
  for (const v of out) {
    if (v.lat !== null) continue
    const near = out.find((w) => w.lat !== null && w.town && w.town === v.town)
    if (near) Object.assign(v, { lat: near.lat, lng: near.lng, geo: 'town' as const })
  }
  return out
}

export const DIRECTORY: DirectoryVenue[] = build()
const INDEX = new Map(DIRECTORY.map((v) => [v.id, v]))
export const directoryVenue = (id: string) => INDEX.get(id)

// ---- distance ---------------------------------------------------------

export const HOME_BASE = { label: 'Newtownabbey', lat: 54.6595, lng: -5.9084 }

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function distanceKm(v: Pick<DirectoryVenue, 'lat' | 'lng'>, from = HOME_BASE): number | null {
  return v.lat === null || v.lng === null ? null : haversineKm(from, { lat: v.lat, lng: v.lng })
}

export const formatKm = (km: number | null) =>
  km === null ? '' : km < 1 ? 'under 1 km' : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`

// ---- search -----------------------------------------------------------

export type VenueSort = 'nearest' | 'az'
export interface VenueFilters {
  q?: string
  councils?: CouncilId[]
  types?: VenueType[]
  maxKm?: number | null
  approvedOnly?: boolean
  /** Hide places whose known capacity is below this; places with unknown capacity stay. */
  minCapacity?: number | null
  includeRegistrar?: boolean
  sort?: VenueSort
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export function searchVenues(list: DirectoryVenue[], f: VenueFilters): (DirectoryVenue & { km: number | null })[] {
  const words = norm(f.q ?? '').split(' ').filter(Boolean)
  const out = list
    .filter((v) => {
      if (!f.includeRegistrar && v.kind === 'registrar' && !(f.types ?? []).includes('registrar')) return false
      if (f.councils?.length && !f.councils.includes(v.council)) return false
      if (f.types?.length && !f.types.includes(v.type)) return false
      if (f.approvedOnly && !v.approved) return false
      if (f.minCapacity && v.capacity !== undefined && v.capacity < f.minCapacity) return false
      if (words.length) {
        const hay = norm(`${v.name} ${v.town} ${v.address} ${COUNCILS[v.council].short} ${venueTypeLabel(v.type)}`)
        if (!words.every((w) => hay.includes(w))) return false
      }
      return true
    })
    .map((v) => ({ ...v, km: distanceKm(v) }))
    .filter((v) => !f.maxKm || (v.km !== null && v.km <= f.maxKm))
  const az = (a: DirectoryVenue, b: DirectoryVenue) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' })
  if ((f.sort ?? 'nearest') === 'az') out.sort(az)
  else out.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9) || az(a, b))
  // Typing a venue's name should put that venue first, then the rest in the chosen order.
  const phrase = words.join(' ')
  if (phrase) {
    const rank = (v: DirectoryVenue) => (norm(v.name).includes(phrase) ? 0 : 1)
    out.sort((a, b) => rank(a) - rank(b))
  }
  return out
}

// ---- links ------------------------------------------------------------

export function osmEmbedUrl(lat: number, lng: number, zoomBox = 0.012) {
  const b = [lng - zoomBox * 1.6, lat - zoomBox, lng + zoomBox * 1.6, lat + zoomBox].map((n) => n.toFixed(5)).join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${b}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`
}
export const osmLink = (lat: number, lng: number) =>
  `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=15/${lat.toFixed(5)}/${lng.toFixed(5)}`
export function directionsUrl(v: Pick<DirectoryVenue, 'name' | 'town' | 'postcode' | 'lat' | 'lng' | 'geo'>) {
  const dest = v.geo === 'place' || v.geo === 'postcode' ? `${v.lat},${v.lng}` : `${v.name}, ${v.town || 'Northern Ireland'}${v.postcode ? ` ${v.postcode}` : ''}`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
}
