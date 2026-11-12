// Guest list logic for the couple only: counts, planning numbers, quick add / bulk paste parsing,
// search, filter and sort. Pure, no React.

import { uid } from '../lib/ids'
import type { AppState, Guest, Household, InvitePart } from '../types'

export type Side = Household['side']
export type Invite = 'day' | 'evening'

export const UNSORTED_ID = '__unsorted'

export function sideLabel(side: Side, names: { a: string; b: string }): string {
  return side === 'a' ? `${names.a}’s` : side === 'b' ? `${names.b}’s` : 'Both'
}

export const isComing = (g: Guest) => g.rsvp !== 'no'
export const isDay = (g: Guest) => g.invitedTo.includes('day')
export const isEveningOnly = (g: Guest) => !isDay(g) && g.invitedTo.includes('evening')
export const inviteOf = (g: Guest): Invite => (isDay(g) ? 'day' : 'evening')
export const invitedToFor = (i: Invite): InvitePart[] => (i === 'day' ? ['day', 'evening'] : ['evening'])

/** Dietary needs are only shown, counted or exported with the guest's consent. */
export const dietaryOf = (g: Guest) => (g.dietaryConsent ? g.dietary.trim() : '')
/** A note saved by an older version before consent was required: hidden until confirmed or cleared. */
export const dietaryHeldWithoutConsent = (g: Guest) => !g.dietaryConsent && !!g.dietary.trim()

export function guestName(g: Guest, all?: Guest[]): string {
  const n = [g.firstName, g.lastName].map((x) => x.trim()).filter(Boolean).join(' ')
  if (n) return n
  if (g.isPlusOne) {
    const host = all?.find((x) => x.id === g.plusOneOfGuestId)
    const hn = host ? host.firstName.trim() : ''
    return hn ? `${hn}’s plus-one` : 'Plus-one'
  }
  return g.child ? 'Child (no name yet)' : 'No name yet'
}

/** Keep the consent rule whatever the caller sends: no consent, no dietary note. */
export function sanitizeGuest(g: Guest, before?: Guest): Guest {
  if (g.dietaryConsent) return g
  // Unticking consent clears the note; a legacy note held without consent is left alone until edited.
  if (before && before.dietaryConsent) return { ...g, dietary: '' }
  if (before && g.dietary === before.dietary) return g
  // A new or changed note without consent is not kept.
  return g.dietary ? { ...g, dietary: '' } : g
}

export interface GuestCounts {
  households: number
  people: number
  coming: number
  day: number
  eveningOnly: number
  adults: number
  children: number
  plusOnes: number
  unnamedPlusOnes: number
  notComing: number
  bySide: Record<Side, number>
  invitesSent: number
  invitesToSend: number
  saveDatesSent: number
  dietary: number
  heldWithoutConsent: number
}

/** Households including a stand-in for people whose household was removed on the other phone. */
export function householdsWithOrphans(state: Pick<AppState, 'households' | 'guests'>): Household[] {
  const ids = new Set(state.households.map((h) => h.id))
  const orphans = state.guests.some((g) => !ids.has(g.householdId))
  return orphans ? [...state.households, { id: UNSORTED_ID, name: 'Unsorted', side: 'both' }] : state.households
}

export function householdOf(state: Pick<AppState, 'households'>, g: Guest): Household | undefined {
  return state.households.find((h) => h.id === g.householdId)
}

export function guestCounts(state: Pick<AppState, 'households' | 'guests'>): GuestCounts {
  const coming = state.guests.filter(isComing)
  const sideOf = (g: Guest): Side => householdOf(state, g)?.side ?? 'both'
  const bySide: Record<Side, number> = { a: 0, b: 0, both: 0 }
  for (const g of coming) bySide[sideOf(g)]++
  const withPeople = state.households.filter((h) => state.guests.some((g) => g.householdId === h.id && isComing(g)))
  const sent = withPeople.filter((h) => h.inviteSent).length
  return {
    households: state.households.length,
    people: state.guests.length,
    coming: coming.length,
    day: coming.filter(isDay).length,
    eveningOnly: coming.filter(isEveningOnly).length,
    adults: coming.filter((g) => !g.child).length,
    children: coming.filter((g) => g.child).length,
    plusOnes: coming.filter((g) => g.isPlusOne).length,
    unnamedPlusOnes: coming.filter((g) => g.isPlusOne && !g.firstName.trim()).length,
    notComing: state.guests.length - coming.length,
    bySide,
    invitesSent: sent,
    invitesToSend: withPeople.length - sent,
    saveDatesSent: withPeople.filter((h) => h.saveDateSent).length,
    dietary: coming.filter((g) => !!dietaryOf(g)).length,
    heldWithoutConsent: state.guests.filter(dietaryHeldWithoutConsent).length,
  }
}

/**
 * Numbers the rest of the app plans with (venue capacity, enquiry drafts, catering, final numbers):
 * the real list once anyone is on it, otherwise the rough guess from onboarding.
 */
export function planningNumbers(state: Pick<AppState, 'households' | 'guests' | 'profile'>): {
  day: number
  evening: number
  children: number
  fromList: boolean
} {
  const c = guestCounts(state)
  if (c.coming > 0) return { day: c.day, evening: c.eveningOnly, children: c.children, fromList: true }
  return { day: state.profile.estimatedDayGuests || 0, evening: state.profile.estimatedEveningGuests || 0, children: 0, fromList: false }
}

export function allGroups(state: Pick<AppState, 'households'>): string[] {
  return [...new Set(state.households.map((h) => h.group?.trim()).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b))
}
export function allTags(state: Pick<AppState, 'guests'>): string[] {
  return [...new Set(state.guests.flatMap((g) => g.tags ?? []).map((t) => t.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

// ---------------------------------------------------------------- quick add / bulk paste

export interface ParsedPerson {
  first: string
  last: string
  child: boolean
  plusOne: boolean
}
export interface ParsedHousehold {
  name: string
  people: ParsedPerson[]
  side: Side
  invite: Invite
  group: string
  tags: string[]
}
export interface ParseDefaults {
  side: Side
  invite: Invite
  group?: string
  names?: { a: string; b: string }
}

const cap = (s: string) => s.replace(/\s+/g, ' ').trim()
const PLUS_ONE = /(?:^|\s|,)\+\s*(?:1|one|guest)\b|\bplus[\s-]?one\b|\band guest\b/gi
const HEADER = /^(names?|household|guest|guests|who)\b/i

function sideWord(w: string, d: ParseDefaults): Side | null {
  const x = w.trim().toLowerCase().replace(/['’]s$/, '')
  if (!x) return null
  if (x === 'both' || x === 'shared' || x === 'joint') return 'both'
  if (d.names?.a && x === d.names.a.toLowerCase()) return 'a'
  if (d.names?.b && x === d.names.b.toLowerCase()) return 'b'
  if (x === 'a' || x === 'partner 1') return 'a'
  if (x === 'b' || x === 'partner 2') return 'b'
  return null
}
function inviteWord(w: string): Invite | null {
  const x = w.trim().toLowerCase()
  if (/^(evening|eve|evening only|night|reception only)$/.test(x)) return 'evening'
  if (/^(day|all day|ceremony|day guest|whole day)$/.test(x)) return 'day'
  return null
}

/** Names like "Anna & Tom Smith", "Anna Jones, Tom Smith", "Ben (child)", "Ella (6)". */
function parseNames(text: string): ParsedPerson[] {
  const parts = text
    .split(/\s*(?:&|,|\/|\+|\band\b)\s*/i)
    .map(cap)
    .filter(Boolean)
  const people = parts.map((p): ParsedPerson => {
    const child = /\((?:child|kid|baby|toddler|\d{1,2})\)|\b(?:child|kid)\b/i.test(p)
    const name = cap(p.replace(/\([^)]*\)/g, '').replace(/\b(?:child|kid)\b/gi, ''))
    const words = name.split(' ').filter(Boolean)
    return { first: words[0] ?? '', last: words.slice(1).join(' '), child, plusOne: false }
  })
  // "Anna & Tom Smith": a first name on its own shares the next surname given.
  for (let i = people.length - 1; i >= 0; i--) {
    if (!people[i].last) {
      const next = people.slice(i + 1).find((p) => p.last)
      if (next) people[i].last = next.last
    }
  }
  return people.filter((p) => p.first)
}

export function householdNameFor(people: ParsedPerson[]): string {
  const named = people.filter((p) => !p.plusOne && p.first)
  if (!named.length) return 'New household'
  const adults = named.filter((p) => !p.child)
  const lead = adults.length ? adults : named
  const lasts = [...new Set(lead.map((p) => p.last).filter(Boolean))]
  if (lead.length === 1) return [lead[0].first, lead[0].last].filter(Boolean).join(' ')
  if (lasts.length === 1) return `${lead.map((p) => p.first).join(' & ')} ${lasts[0]}`
  return lead.map((p) => [p.first, p.last].filter(Boolean).join(' ')).join(' & ')
}

/** One household per line. Spreadsheet rows (tab-separated) can carry side, day/evening and group. */
export function parseGuestLine(line: string, d: ParseDefaults): ParsedHousehold | null {
  let text = line.trim()
  if (!text || text.startsWith('//')) return null
  let side = d.side
  let invite = d.invite
  let group = d.group?.trim() ?? ''
  const tags: string[] = []

  if (text.includes('\t') || /;\s*\S/.test(text) && text.split(';').length > 2) {
    const cells = text.split(text.includes('\t') ? '\t' : ';').map(cap)
    text = cells[0]
    if (HEADER.test(text) && cells.length > 1 && cells.slice(1).every((c) => !c || /^(side|day|evening|invite|group|tags?|who|day\/evening)/i.test(c)))
      return null
    let groupSet = false
    for (const c of cells.slice(1)) {
      if (!c) continue
      const s = sideWord(c, d)
      const i = inviteWord(c)
      if (s) side = s
      else if (i) invite = i
      else if (!groupSet) {
        group = c
        groupSet = true
      } else tags.push(...c.split(/\s*,\s*/).filter(Boolean))
    }
  }

  text = text.replace(/#([\p{L}\p{N}_-]+)/gu, (_, t: string) => {
    tags.push(t.replace(/[-_]/g, ' '))
    return ' '
  })
  text = text.replace(/\((evening|eve|evening only|day)\)|\bevening only\b/gi, (m) => {
    invite = /day/i.test(m) && !/evening/i.test(m) ? 'day' : 'evening'
    return ' '
  })
  let plusOnes = 0
  text = text.replace(PLUS_ONE, () => {
    plusOnes++
    return ' '
  })
  // "kids: Ben, Ella"
  let kids: ParsedPerson[] = []
  text = text.replace(/\b(?:kids|children)\s*:\s*(.+)$/i, (_, list: string) => {
    kids = parseNames(list).map((k) => ({ ...k, child: true }))
    return ' '
  })
  text = cap(text.replace(/[,;&]+\s*$/, ''))
  const hhOnly = /^the\s+\S+/i.test(text) && !/[&,]/.test(text)
  const adults = hhOnly ? [] : parseNames(text)
  const surname = adults.find((a) => a.last)?.last ?? ''
  for (const k of kids) if (!k.last) k.last = surname
  const people = [...adults, ...kids]
  for (let i = 0; i < plusOnes; i++) people.push({ first: '', last: '', child: false, plusOne: true })
  if (!people.length && !hhOnly) return null
  return { name: hhOnly ? cap(text) : householdNameFor(people), people, side, invite, group, tags }
}

export function parseGuestText(text: string, d: ParseDefaults): ParsedHousehold[] {
  return text
    .split(/\r?\n/)
    .map((l) => parseGuestLine(l, d))
    .filter((x): x is ParsedHousehold => !!x)
}

/** Records for parsed lines: plus-ones are linked to the first adult in their household. */
export function recordsFor(parsed: ParsedHousehold[], now = new Date().toISOString()): { households: Household[]; guests: Guest[] } {
  const households: Household[] = []
  const guests: Guest[] = []
  for (const p of parsed) {
    const hh: Household = { id: uid('hh'), name: p.name, side: p.side, addedAt: now, ...(p.group ? { group: p.group } : {}) }
    households.push(hh)
    let host: Guest | undefined
    for (const person of p.people) {
      const g: Guest = {
        id: uid('g'),
        householdId: hh.id,
        firstName: person.first,
        lastName: person.last,
        isPlusOne: person.plusOne,
        plusOneNamed: !person.plusOne,
        child: person.child,
        invitedTo: invitedToFor(p.invite),
        rsvp: 'pending',
        meal: '',
        dietary: '',
        dietaryConsent: false,
        travelFrom: '',
        notes: '',
        addedAt: now,
        ...(p.tags.length ? { tags: [...p.tags] } : {}),
      }
      if (person.plusOne) g.plusOneOfGuestId = host?.id
      else if (!host && !person.child) host = g
      guests.push(g)
    }
  }
  return { households, guests }
}

// ---------------------------------------------------------------- search, filter, sort

export type GuestStatus = 'all' | 'toInvite' | 'invited' | 'unnamed' | 'children' | 'plusOnes' | 'dietary' | 'notComing'
export type GuestSort = 'name' | 'surname' | 'side' | 'group' | 'added'
export interface GuestQuery {
  q: string
  side: 'all' | Side
  invite: 'all' | Invite
  group: string
  tag: string
  status: GuestStatus
  sort: GuestSort
}
export const DEFAULT_QUERY: GuestQuery = { q: '', side: 'all', invite: 'all', group: '', tag: '', status: 'all', sort: 'name' }

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function personMatches(g: Guest, q: GuestQuery): boolean {
  if (q.invite !== 'all' && inviteOf(g) !== q.invite) return false
  if (q.tag && !(g.tags ?? []).includes(q.tag)) return false
  switch (q.status) {
    case 'unnamed':
      if (g.firstName.trim()) return false
      break
    case 'children':
      if (!g.child) return false
      break
    case 'plusOnes':
      if (!g.isPlusOne) return false
      break
    case 'dietary':
      if (!dietaryOf(g)) return false
      break
    case 'notComing':
      if (isComing(g)) return false
      break
  }
  if (q.status !== 'notComing' && q.status !== 'all' && !isComing(g)) return false
  return true
}

function textMatches(hh: Household, g: Guest | null, words: string[], all: Guest[]): boolean {
  if (!words.length) return true
  const hay = norm(
    [hh.name, hh.group ?? '', hh.notes ?? '', ...(g ? [guestName(g, all), g.notes, (g.tags ?? []).join(' '), g.travelFrom] : [])].join(' '),
  )
  return words.every((w) => hay.includes(w))
}

const sideRank: Record<Side, number> = { a: 0, b: 1, both: 2 }

export interface HouseholdRow {
  household: Household
  guests: Guest[]
  /** All members, for counts on the card. */
  members: Guest[]
}

/** Households (with the members that match) for the list view. */
export function queryHouseholds(state: Pick<AppState, 'households' | 'guests'>, q: GuestQuery): HouseholdRow[] {
  const words = norm(q.q).split(/\s+/).filter(Boolean)
  const all = state.guests
  const order = new Map(state.households.map((h, i) => [h.id, i]))
  const personFilter = q.invite !== 'all' || !!q.tag || !['all', 'toInvite', 'invited'].includes(q.status)
  const rows: HouseholdRow[] = []
  for (const hh of householdsWithOrphans(state)) {
    const members = all.filter((g) => (hh.id === UNSORTED_ID ? !order.has(g.householdId) : g.householdId === hh.id))
    if (q.side !== 'all' && hh.side !== q.side) continue
    if (q.group && (hh.group ?? '') !== q.group) continue
    if (q.status === 'toInvite' && (hh.inviteSent || !members.some(isComing))) continue
    if (q.status === 'invited' && !hh.inviteSent) continue
    let guests = personFilter ? members.filter((g) => personMatches(g, q)) : members
    if (personFilter && !guests.length) continue
    if (words.length) {
      // People who match the search themselves; otherwise the whole household if its name or group does.
      const people = guests.filter((g) => textMatches({ ...hh, name: '', group: '', notes: '' }, g, words, all))
      if (people.length) guests = people
      else if (!textMatches(hh, null, words, all)) continue
    }
    rows.push({ household: hh, guests, members })
  }
  const surname = (r: HouseholdRow) => norm(r.members.find((g) => g.lastName)?.lastName ?? r.household.name.replace(/^the\s+/i, ''))
  const byName = (a: HouseholdRow, b: HouseholdRow) => norm(a.household.name.replace(/^the\s+/i, '')).localeCompare(norm(b.household.name.replace(/^the\s+/i, '')))
  const cmp: Record<GuestSort, (a: HouseholdRow, b: HouseholdRow) => number> = {
    name: byName,
    surname: (a, b) => surname(a).localeCompare(surname(b)) || byName(a, b),
    side: (a, b) => sideRank[a.household.side] - sideRank[b.household.side] || byName(a, b),
    group: (a, b) => {
      const ga = a.household.group ?? ''
      const gb = b.household.group ?? ''
      if (!ga !== !gb) return ga ? -1 : 1
      return ga.localeCompare(gb) || byName(a, b)
    },
    added: (a, b) => (order.get(b.household.id) ?? 1e9) - (order.get(a.household.id) ?? 1e9),
  }
  return rows.sort((a, b) => (a.household.id === UNSORTED_ID ? 1 : b.household.id === UNSORTED_ID ? -1 : cmp[q.sort](a, b)))
}

/** Flat list of people for the table view, in the household sort, then surname/first name. */
export function queryPeople(state: Pick<AppState, 'households' | 'guests'>, q: GuestQuery): { guest: Guest; household: Household }[] {
  const rows = queryHouseholds(state, q)
  const out = rows.flatMap((r) => r.guests.map((g) => ({ guest: g, household: r.household })))
  if (q.sort === 'surname' || q.sort === 'name') {
    const key = (g: Guest) => (q.sort === 'surname' ? `${norm(g.lastName) || 'zzz'} ${norm(g.firstName)}` : `${norm(g.firstName) || 'zzz'} ${norm(g.lastName)}`)
    out.sort((a, b) => key(a.guest).localeCompare(key(b.guest)))
  }
  return out
}
