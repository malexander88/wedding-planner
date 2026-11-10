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

export function feeForDate(iso: string, band: FeeBand): { amount: number; reason: string } {
  if (isNiHoliday(iso)) return { amount: band.holiday, reason: 'public holiday' }
  const day = weekdayIndex(iso)
  if (day === 0) return { amount: band.holiday, reason: 'Sunday' }
  if (day === 6) return { amount: band.saturday, reason: 'Saturday' }
  return { amount: band.weekday, reason: 'weekday' }
}

export function noticeDueDate(weddingDate: string, previouslyMarried: boolean): string {
  return addDays(weddingDate, previouslyMarried ? -70 : -56)
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
