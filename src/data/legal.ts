import { isNiHoliday } from './holidays'

export const LINKS = {
  notice: 'https://www.nidirect.gov.uk/articles/how-and-when-give-notice-marriage',
  civil: 'https://www.nidirect.gov.uk/articles/getting-married-civil-ceremony',
  religious: 'https://www.nidirect.gov.uk/articles/getting-married-religiousbelief-ceremony',
  registration: 'https://www.nidirect.gov.uk/articles/registration-services',
  registrars: 'https://www.nidirect.gov.uk/contacts/district-registrars-northern-ireland',
  newtownabbey:
    'https://www.nidirect.gov.uk/contacts/antrim-and-newtownabbey-district-registrar-newtownabbey-registration-office',
  venues:
    'https://www.nidirect.gov.uk/articles/registration-office-venues-civil-marriage-and-civil-partnerships',
  immigration: 'https://www.nidirect.gov.uk/articles/marriagecivil-partnership-and-immigration-control',
  noticeForm: 'https://www.nidirect.gov.uk/sites/default/files/2025-05/GRO446-marriage-notice-form-v04.25.pdf',
  certificate: 'https://www.nidirect.gov.uk/services/order-marriage-certificate-online',
  anbcMarriages:
    'https://antrimandnewtownabbey.gov.uk/residents/births-deaths-marriages-civil-partnerships/marriages/',
  anbcVenues:
    'https://antrimandnewtownabbey.gov.uk/residents/births-deaths-marriages-civil-partnerships/where-to-have-a-ceremony/',
}

export type FeeBand = {
  label: string
  weekday: number
  saturday: number
  holiday: number
  note: string
  /** The council doesn't hold registrar ceremonies on Sundays. */
  noSundays?: boolean
}

/** Published ANBC ceremony / registrar attendance fees, checked November 2026. */
export const ANBC_FEES = {
  civic: {
    label: 'Antrim Civic Centre',
    weekday: 210,
    saturday: 470,
    holiday: 490,
    note: 'Whinstone Marriage Suite, as published by ANBC.',
  },
  townHall: {
    label: 'Ballyclare Town Hall',
    weekday: 150,
    saturday: 350,
    holiday: 390,
    note: 'As published by ANBC.',
  },
  approved: {
    label: 'Approved venue (registrar attendance)',
    weekday: 240,
    saturday: 400,
    holiday: 420,
    note: 'ANBC fee for the registrar to attend Castle Gardens, the Old Courthouse, Sentry Hill or an approved hotel or private venue. The venue’s own hire charge is extra.',
  },
} satisfies Record<string, FeeBand>

export type CouncilId = 'anbc' | 'belfast' | 'mea'

export type Council = {
  id: CouncilId
  name: string
  short: string
  /** Fee for a registrar to attend an approved venue. */
  approved: FeeBand
  sourceUrl: string
  sourceLabel: string
  /** Lower-case place names that sit in this council area (matched against venue name + area). */
  places: string[]
}

/** Registrar attendance fees at approved venues, from each council's own page (checked November 2026). */
export const COUNCILS: Record<CouncilId, Council> = {
  anbc: {
    id: 'anbc',
    name: 'Antrim & Newtownabbey Borough Council',
    short: 'Antrim & Newtownabbey',
    approved: ANBC_FEES.approved,
    sourceUrl: LINKS.anbcVenues,
    sourceLabel: 'ANBC ceremony fees',
    places: [
      'antrim', 'newtownabbey', 'ballyclare', 'templepatrick', 'doagh', 'glengormley', 'crumlin', 'randalstown',
      'ballyrobert', 'dunadry', 'aldergrove', 'toome', 'toomebridge', 'jordanstown', 'mossley', 'carnmoney',
      'parkgate', 'ballynure', 'whiteabbey', 'monkstown', 'muckamore', 'dunsilly', 'shane',
    ],
  },
  belfast: {
    id: 'belfast',
    name: 'Belfast City Council',
    short: 'Belfast',
    approved: {
      label: 'Belfast approved venue (registrar attendance)',
      weekday: 383,
      saturday: 600,
      holiday: 632,
      note: 'Belfast City Council fee for a registrar to attend an approved venue. With the two £22 notice fees and the £36 ceremony fee the published totals are £463 weekday, £680 Saturday and £712 bank holiday. Ceremonies run Monday to Saturday.',
      noSundays: true,
    },
    sourceUrl:
      'https://www.belfastcity.gov.uk/births-deaths-and-ceremonies/births-deaths-marriages-and-civil-partnerships/marriages/getting-married-in-a-civil-ceremony',
    sourceLabel: 'Belfast City Council marriage fees',
    places: ['belfast'],
  },
  mea: {
    id: 'mea',
    name: 'Mid and East Antrim Borough Council',
    short: 'Mid & East Antrim',
    approved: {
      label: 'Mid & East Antrim approved venue (registrar-led)',
      weekday: 200,
      saturday: 240,
      holiday: 296,
      note: 'Mid and East Antrim fee for a registrar-led ceremony at an approved venue (prices from 1 April 2025, includes one certificate). Venue hire is paid to the venue.',
    },
    sourceUrl: 'https://www.midandeastantrim.gov.uk/resident/bdmcp/marriages',
    sourceLabel: 'Mid and East Antrim marriage fees',
    places: [
      'ballymena', 'galgorm', 'cullybackey', 'larne', 'carrickfergus', 'whitehead', 'islandmagee', 'broughshane',
      'glenarm', 'ballygally', 'portglenone', 'ballycarry', 'ahoghill', 'kells', 'magheramorne', 'gobbins', 'carnfunnock',
    ],
  },
}

/** Which council a place is in, from the words in its name and area. Null when unknown or ambiguous. */
export function councilFromText(text: string): CouncilId | null {
  const t = text.toLowerCase()
  const hits = (Object.values(COUNCILS) as Council[]).filter((c) =>
    c.places.some((p) => new RegExp(`\\b${p}`).test(t)),
  )
  return hits.length === 1 ? hits[0].id : null
}

export type VenueFee = { council: CouncilId | null; band: FeeBand | null; label: string }

/** The registrar fee band for one shortlisted venue: its own council, never a default. */
export function venueFeeBand(
  v: { catalogueId?: string; council?: CouncilId; name: string; area: string },
  catalogueArea?: string,
): VenueFee {
  if (v.catalogueId === 'venue-antrim-civic')
    return { council: 'anbc', band: ANBC_FEES.civic, label: 'Antrim & Newtownabbey council room' }
  if (v.catalogueId === 'venue-ballyclare-town-hall')
    return { council: 'anbc', band: ANBC_FEES.townHall, label: 'Antrim & Newtownabbey council room' }
  const id = v.council ?? councilFromText(`${v.name} ${catalogueArea ?? v.area}`)
  if (!id) return { council: null, band: null, label: 'Council not known yet' }
  const c = COUNCILS[id]
  return { council: id, band: c.approved, label: `${c.short} approved venue` }
}

export const NIDIRECT_SOLEMNISATION = {
  weekdayDay: 36,
  weekdayEveningOrSaturday: 162,
  sundayOrHoliday: 216,
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function weekdayIndex(iso: string): number {
  return new Date(iso + 'T12:00:00').getDay()
}

export function feeForDate(iso: string, band: FeeBand): { amount: number | null; reason: string } {
  const day = weekdayIndex(iso)
  if (day === 0 && band.noSundays) return { amount: null, reason: 'no Sunday ceremonies' }
  if (isNiHoliday(iso)) return { amount: band.holiday, reason: 'public holiday' }
  if (day === 0) return { amount: band.holiday, reason: 'Sunday' }
  if (day === 6) return { amount: band.saturday, reason: 'Saturday' }
  return { amount: band.weekday, reason: 'weekday' }
}

export function noticeDueDate(weddingDate: string, previouslyMarried: boolean): string {
  return addDays(weddingDate, previouslyMarried ? -70 : -56)
}

/** Same day of the month, n months earlier/later (clamped to the month's last day). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(d, last))
  return first.toISOString().slice(0, 10)
}

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export type DateCheck = { level: 'past' | 'blocked' | 'tight' | 'ok'; text: string }

/** Is a wedding date still workable for Northern Ireland notice (28 days minimum, 8/10 weeks recommended)? */
export function checkWeddingDate(iso: string, today = todayIso(), previouslyMarried = false): DateCheck {
  const days = daysBetween(today, iso)
  if (days < 0) return { level: 'past', text: 'This date has passed.' }
  if (days < 28) return { level: 'blocked', text: `Only ${days} day${days === 1 ? '' : 's'} away — notice must be given at least 28 days before, so this date is too soon.` }
  const rec = previouslyMarried ? 70 : 56
  if (days < rec)
    return { level: 'tight', text: `Under ${rec / 7} weeks away — notice must reach the registrar by ${formatShort(noticeMinimumDate(iso))} at the latest. Tight but possible.` }
  return { level: 'ok', text: '' }
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + 'T12:00:00Z') - Date.parse(fromIso + 'T12:00:00Z')) / 86400000)
}

export function noticeMinimumDate(weddingDate: string): string {
  return addDays(weddingDate, -28)
}

export function scheduleFromDate(weddingDate: string): string {
  return addDays(weddingDate, -14)
}

export function scheduleReturnDate(weddingDate: string): string {
  return addDays(weddingDate, 3)
}

export function seasonOf(iso: string): 'spring' | 'summer' | 'autumn' | 'winter' {
  const m = Number(iso.slice(5, 7))
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

export function formatLong(iso?: string): string {
  if (!iso) return 'Not set'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatShort(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function daysUntil(iso: string, from = new Date()): number {
  const a = new Date(from.toISOString().slice(0, 10) + 'T12:00:00').getTime()
  const b = new Date(iso + 'T12:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

export function anbcBandForCatalogueId(catalogueId?: string): FeeBand {
  if (catalogueId === 'venue-antrim-civic') return ANBC_FEES.civic
  if (catalogueId === 'venue-ballyclare-town-hall') return ANBC_FEES.townHall
  return ANBC_FEES.approved
}
