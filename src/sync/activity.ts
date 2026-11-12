// Plain-words feed of what the partner's phone changed.
//
// Built from the sync bookkeeping we already keep: every record and profile field carries a clock
// stamped with the id of the phone that last edited it. When a sync pulls in a newer version, any
// record whose clock belongs to a different phone was changed by the partner. Nothing extra is
// sent or stored on the server; the feed lives on this phone only (IndexedDB, capped).
//
// Privacy: entries name people and suppliers already in the plan but never include contact
// details, dietary notes, guest notes or free-text notes.

import { isBlankPlan } from '../data/blank'
import { mergeTasks } from '../data/checklist'
import { guestName } from '../data/guests'
import { formatLong } from '../data/legal'
import { money } from '../lib/money'
import type { AppState } from '../types'
import { COLLECTIONS, stableStringify, type SyncDoc } from './merge'

export type ActivityArea = 'plan' | 'guests' | 'find' | 'budget' | 'dates' | 'seating' | 'runsheet' | 'other'

export interface ActivityItem {
  id: string
  /** When the partner made the change (their clock). */
  t: number
  /** When this phone received it. */
  at: number
  text: string
  area: ActivityArea
  href?: string
}

type AnyRecord = Record<string, unknown>
type Verb = 'added' | 'changed' | 'removed'

interface Raw {
  t: number
  area: ActivityArea
  /** Changes with the same group collapse into one line when there are several. */
  group: string
  one: string
  many?: (n: number) => string
  href?: string
}

const AREA_HREF: Record<ActivityArea, string> = {
  plan: '/plan',
  guests: '/guests',
  find: '/find',
  budget: '/budget',
  dates: '/dates',
  seating: '/seating',
  runsheet: '/run-sheet',
  other: '/',
}

const STATUS_WORD: Record<string, string> = {
  shortlisted: 'shortlisted',
  enquired: 'enquired',
  quoted: 'quoted',
  viewed: 'viewed',
  booked: 'booked',
  rejected: 'ruled out',
}

const q = (s: unknown) => `“${String(s ?? '').trim() || 'untitled'}”`
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function index(list: unknown, keyOf: (r: AnyRecord) => string): Map<string, AnyRecord> {
  const map = new Map<string, AnyRecord>()
  if (Array.isArray(list)) for (const r of list) if (r && typeof r === 'object') map.set(keyOf(r as AnyRecord), r as AnyRecord)
  return map
}

interface Lookup {
  supplier: (id: unknown) => string
  task: (key: unknown) => string
  guest: (id: unknown) => string
  table: (id: unknown) => string
}

function lookups(before: AppState, after: AppState): Lookup {
  const sup = new Map<string, string>()
  const tasks = new Map<string, string>()
  const guests = new Map<string, string>()
  const tables = new Map<string, string>()
  for (const s of [before, after]) {
    for (const x of s.suppliers ?? []) sup.set(x.id, x.name)
    try {
      for (const t of mergeTasks(s)) tasks.set(t.key, t.title)
    } catch {
      /* a half-loaded plan: fall back to generic words */
    }
    for (const g of s.guests ?? []) guests.set(g.id, guestName(g, s.guests))
    for (const t of s.seatingTables ?? []) tables.set(t.id, t.name)
  }
  return {
    supplier: (id) => sup.get(String(id)) || 'a supplier',
    task: (key) => tasks.get(String(key)) || 'a task',
    guest: (id) => guests.get(String(id)) || 'a guest',
    table: (id) => tables.get(String(id)) || 'a table',
  }
}

function recordLine(name: string, verb: Verb, a: AnyRecord | undefined, b: AnyRecord | undefined, L: Lookup): Omit<Raw, 't'> | null {
  const r = (b ?? a)!
  switch (name) {
    case 'households': {
      const n = str(r.name) || 'a'
      if (verb === 'changed' && a && b && !a.inviteSent && b.inviteSent)
        return { area: 'guests', group: 'hh-invite', one: `marked the invitation to the ${n} household as sent`, many: (k) => `marked ${plural(k, 'invitation')} as sent` }
      if (verb === 'changed' && a && b && !a.saveDateSent && b.saveDateSent)
        return { area: 'guests', group: 'hh-std', one: `marked the save-the-date to the ${n} household as sent`, many: (k) => `marked ${plural(k, 'save-the-date')} as sent` }
      const word = verb === 'added' ? 'added' : verb === 'removed' ? 'removed' : 'updated'
      return { area: 'guests', group: `hh-${verb}`, one: `${word} the ${n} household`, many: (k) => `${word} ${plural(k, 'household')}` }
    }
    case 'guests': {
      const n = guestName(r as never)
      if (verb === 'added') return { area: 'guests', group: 'g-added', one: `added ${n} to the guest list`, many: (k) => `added ${plural(k, 'guest')}` }
      if (verb === 'removed') return { area: 'guests', group: 'g-removed', one: `removed ${n} from the guest list`, many: (k) => `removed ${plural(k, 'guest')}` }
      if (a?.rsvp !== 'no' && b?.rsvp === 'no')
        return { area: 'guests', group: 'g-no', one: `marked ${n} as not coming`, many: (k) => `marked ${plural(k, 'guest')} as not coming` }
      return { area: 'guests', group: 'g-changed', one: `updated ${n}`, many: (k) => `updated ${plural(k, 'guest')}` }
    }
    case 'events': {
      const n = str(r.name) || 'an event'
      if (verb === 'changed' && a?.start !== b?.start)
        return { area: 'runsheet', group: `ev-${String(r.id)}`, one: str(b?.start) ? `set the ${n.toLowerCase()} time to ${str(b?.start)}` : `cleared the ${n.toLowerCase()} time` }
      return { area: 'runsheet', group: `ev-${verb}`, one: `${verb === 'changed' ? 'updated' : verb} ${n}` }
    }
    case 'suppliers': {
      const n = str(r.name) || 'a supplier'
      const href = verb === 'removed' ? '/find' : `/find/${String(r.id)}`
      if (verb === 'added' && r.status === 'booked') return { area: 'find', group: `s-bk-${String(r.id)}`, one: `added and booked ${n}`, href }
      if (verb === 'added') return { area: 'find', group: 's-added', one: `shortlisted ${n}`, many: (k) => `shortlisted ${plural(k, 'supplier')}`, href }
      if (verb === 'removed') return { area: 'find', group: 's-removed', one: `removed ${n} from the shortlist`, many: (k) => `removed ${plural(k, 'supplier')} from the shortlist`, href }
      if (a?.status !== b?.status) {
        const s = String(b?.status)
        return { area: 'find', group: `s-st-${String(r.id)}`, one: s === 'booked' ? `booked ${n}` : `marked ${n} as ${STATUS_WORD[s] ?? s}`, href }
      }
      return { area: 'find', group: `s-ch-${String(r.id)}`, one: `updated ${n}`, href }
    }
    case 'quotes': {
      const who = L.supplier(r.supplierId)
      const amt = typeof r.amount === 'number' && r.amount > 0 ? `${money(r.amount)} ` : ''
      if (verb === 'added') return { area: 'find', group: 'qa', one: `added a ${amt}quote from ${who}`, many: (k) => `added ${plural(k, 'quote')}`, href: `/find/${String(r.supplierId)}` }
      if (verb === 'removed') return { area: 'find', group: 'qr', one: `removed a quote from ${who}`, many: (k) => `removed ${plural(k, 'quote')}` }
      return { area: 'find', group: 'qc', one: `updated the quote from ${who}`, many: (k) => `updated ${plural(k, 'quote')}`, href: `/find/${String(r.supplierId)}` }
    }
    case 'budgetLines': {
      const n = q(r.name)
      if (verb === 'added') return { area: 'budget', group: 'bl-a', one: `added ${n} to the budget`, many: (k) => `added ${plural(k, 'budget line')}` }
      if (verb === 'removed') return { area: 'budget', group: 'bl-r', one: `removed ${n} from the budget`, many: (k) => `removed ${plural(k, 'budget line')}` }
      return { area: 'budget', group: 'bl-c', one: `updated ${n} in the budget`, many: (k) => `updated ${plural(k, 'budget line')}` }
    }
    case 'payments': {
      const amt = typeof r.amount === 'number' && r.amount > 0 ? `${money(r.amount)} ` : ''
      const to = r.supplierId ? ` to ${L.supplier(r.supplierId)}` : ''
      if (verb === 'changed' && !str(a?.paidDate) && str(b?.paidDate))
        return { area: 'budget', group: 'p-paid', one: `marked a ${amt}payment${to} as paid`, many: (k) => `marked ${plural(k, 'payment')} as paid` }
      if (verb === 'added') return { area: 'budget', group: 'p-a', one: `added a ${amt}payment${to}`, many: (k) => `added ${plural(k, 'payment')}` }
      if (verb === 'removed') return { area: 'budget', group: 'p-r', one: `removed a payment${to}`, many: (k) => `removed ${plural(k, 'payment')}` }
      return { area: 'budget', group: 'p-c', one: `updated a payment${to}`, many: (k) => `updated ${plural(k, 'payment')}` }
    }
    case 'tasks': {
      const title = str(r.titleOverride) || str(r.title) || L.task(r.key)
      // Built-in tasks get an override record the first time they are edited: that is an edit, not a new task.
      if (verb === 'added' && r.custom) return { area: 'plan', group: 't-a', one: `added the task ${q(title)}`, many: (k) => `added ${plural(k, 'task')}` }
      if (verb === 'removed' || (!a?.removed && b?.removed)) return { area: 'plan', group: 't-r', one: `removed the task ${q(title)}`, many: (k) => `removed ${plural(k, 'task')}` }
      if (!a?.hidden && b?.hidden) return { area: 'plan', group: 't-h', one: `hid ${q(title)}`, many: (k) => `hid ${plural(k, 'task')}` }
      const due = (x?: AnyRecord) => str(x?.dueOverride) || str(x?.dueDate)
      if (due(a) !== due(b) && due(b)) return { area: 'plan', group: 't-d', one: `moved ${q(title)} to ${formatLong(due(b))}`, many: (k) => `re-dated ${plural(k, 'task')}` }
      if (a?.assignee !== b?.assignee && b?.assignee) return { area: 'plan', group: 't-as', one: `assigned ${q(title)}`, many: (k) => `assigned ${plural(k, 'task')}` }
      return { area: 'plan', group: 't-c', one: `edited ${q(title)}`, many: (k) => `edited ${plural(k, 'task')}` }
    }
    case 'taskDetails':
      return { area: 'plan', group: 'td', one: `${verb === 'removed' ? 'cleared' : 'filled in'} details for ${q(L.task(r.taskKey))}`, many: (k) => `filled in details for ${plural(k, 'task')}` }
    case 'venueDates': {
      const sup = L.supplier(r.supplierId)
      const when = str(r.date) ? ` on ${formatLong(str(r.date))}` : ''
      const av = String(r.availability ?? '')
      const word = av === 'available' ? 'free' : av === 'hold' ? 'holding the date' : av === 'unavailable' ? 'taken' : 'not sure yet'
      return {
        area: 'dates',
        group: 'vd',
        one: verb === 'removed' ? `cleared the date mark for ${sup}${when}` : `marked ${sup} as ${word}${when}`,
        many: (k) => `updated ${plural(k, 'venue date')}`,
      }
    }
    case 'seatingTables':
      if (verb === 'added') return { area: 'seating', group: 'seat', one: `added ${str(r.name) || 'a table'} to the seating plan`, many: () => 'updated the seating plan' }
      if (verb === 'removed') return { area: 'seating', group: 'seat', one: `removed ${str(r.name) || 'a table'} from the seating plan`, many: () => 'updated the seating plan' }
      return { area: 'seating', group: 'seat', one: `updated ${str(r.name) || 'a table'} on the seating plan`, many: () => 'updated the seating plan' }
    case 'seatingAssignments':
      if (verb === 'removed') return { area: 'seating', group: 'seat', one: `took ${L.guest(r.guestId)} off ${L.table(r.tableId)}`, many: () => 'updated the seating plan' }
      return { area: 'seating', group: 'seat', one: `seated ${L.guest(r.guestId)} at ${L.table(b?.tableId)}`, many: () => 'updated the seating plan' }
    case 'seatingRules':
      return { area: 'seating', group: 'seat', one: 'updated a seating note', many: () => 'updated the seating plan' }
    case 'runSheet': {
      const n = q(r.title)
      if (verb === 'added') return { area: 'runsheet', group: 'rs-a', one: `added ${n} to the run sheet`, many: (k) => `added ${plural(k, 'item')} to the run sheet` }
      if (verb === 'removed') return { area: 'runsheet', group: 'rs-r', one: `removed ${n} from the run sheet`, many: (k) => `removed ${plural(k, 'item')} from the run sheet` }
      if (a?.time !== b?.time && str(b?.time)) return { area: 'runsheet', group: 'rs-c', one: `moved ${n} to ${str(b?.time)}`, many: (k) => `changed ${plural(k, 'item')} on the run sheet` }
      return { area: 'runsheet', group: 'rs-c', one: `changed ${n} on the run sheet`, many: (k) => `changed ${plural(k, 'item')} on the run sheet` }
    }
    case 'gifts':
      return { area: 'other', group: 'gifts', one: 'updated the gift list', many: () => 'updated the gift list' }
    case 'moodBoard':
      return { area: 'other', group: 'mood', one: 'updated the mood board', many: () => 'updated the mood board' }
    default:
      return null
  }
}

const PROFILE_LINES: Record<string, (v: unknown, L: Lookup) => [ActivityArea, string] | null> = {
  date: (v) => ['dates', str(v) ? `set the wedding date to ${formatLong(str(v))}` : 'cleared the wedding date'],
  candidateDates: () => ['dates', 'changed the dates you’re comparing'],
  totalBudget: (v) => ['budget', `changed the total budget to ${money(Number(v) || 0)}`],
  bufferPercent: (v) => ['budget', `set the contingency to ${Number(v) || 0}%`],
  estimatedDayGuests: (v) => ['guests', `changed the day guest estimate to ${Number(v) || 0}`],
  estimatedEveningGuests: (v) => ['guests', `changed the evening guest estimate to ${Number(v) || 0}`],
  area: (v) => ['other', `changed the area to ${str(v) || 'not set'}`],
  style: (v) => ['other', `changed the style to ${str(v) || 'not set'}`],
  season: (v) => ['dates', `changed the season to ${str(v) || 'any'}`],
  ceremonyType: (v) => ['plan', `changed the ceremony type to ${str(v) || 'not set'}`],
  venueSupplierId: (v, L) => ['find', str(v) ? `chose ${L.supplier(v)} as the venue` : 'cleared the chosen venue'],
  currency: (v) => ['budget', `switched the plan to ${v === 'EUR' ? 'euros (€)' : 'pounds (£)'}`],
  partnerAName: (v) => ['other', `changed a name to ${str(v)}`],
  partnerBName: (v) => ['other', `changed a name to ${str(v)}`],
}

let seq = 0
const newId = (t: number) => `a${t.toString(36)}${(seq++).toString(36)}`

/**
 * What another phone changed between this phone's `before` plan and the merged `after` doc.
 * Only changes whose clocks belong to a different device are listed.
 */
export function describeRemoteChanges(before: AppState, after: SyncDoc, myDevice: string, now = Date.now(), limit = 15): ActivityItem[] {
  if (!myDevice) return []
  // Joining the partner's plan on a fresh phone: one line, not hundreds.
  if (isBlankPlan(before) && !isBlankPlan(after.state))
    return [{ id: newId(now), t: now, at: now, area: 'other', text: 'shared the plan with this phone', href: '/' }]
  if (!isBlankPlan(before) && isBlankPlan(after.state))
    return [{ id: newId(now), t: now, at: now, area: 'other', text: 'erased the shared plan', href: '/settings' }]

  const L = lookups(before, after.state)
  const raws: Raw[] = []
  const isTheirs = (c: { d: string } | undefined) => !!c && c.d !== myDevice && c.d !== 'pending'

  for (const [name, keyOf] of Object.entries(COLLECTIONS)) {
    const a = (before as unknown as AnyRecord)[name]
    const b = (after.state as unknown as AnyRecord)[name]
    if (a === b) continue
    const ia = index(a, keyOf)
    const ib = index(b, keyOf)
    const clocks = after.meta.records[name] ?? {}
    for (const k of new Set([...ia.keys(), ...ib.keys()])) {
      const ra = ia.get(k)
      const rb = ib.get(k)
      if (ra && rb && stableStringify(ra) === stableStringify(rb)) continue
      const c = clocks[k]
      if (!isTheirs(c)) continue
      const verb: Verb = !ra ? 'added' : !rb ? 'removed' : 'changed'
      const line = recordLine(name, verb, ra, rb, L)
      if (line) raws.push({ ...line, t: c.t })
    }
  }

  const pa = (before.profile ?? {}) as unknown as AnyRecord
  const pb = (after.state.profile ?? {}) as unknown as AnyRecord
  const pc = after.meta.fields.profile ?? {}
  for (const k of Object.keys(PROFILE_LINES)) {
    if (stableStringify(pa[k]) === stableStringify(pb[k]) || !isTheirs(pc[k])) continue
    const r = PROFILE_LINES[k](pb[k], L)
    if (r) raws.push({ t: pc[k].t, area: r[0], group: `pf-${k}`, one: r[1] })
  }

  const da = before.taskDone ?? {}
  const db = after.state.taskDone ?? {}
  const dc = after.meta.fields.taskDone ?? {}
  for (const k of new Set([...Object.keys(da), ...Object.keys(db)])) {
    if (!!da[k] === !!db[k] || !isTheirs(dc[k])) continue
    raws.push(
      db[k]
        ? { t: dc[k].t, area: 'plan', group: 'done', one: `ticked off ${q(L.task(k))}`, many: (n) => `ticked off ${plural(n, 'task')}` }
        : { t: dc[k].t, area: 'plan', group: 'undone', one: `reopened ${q(L.task(k))}`, many: (n) => `reopened ${plural(n, 'task')}` },
    )
  }

  // Collapse several of the same kind into one line.
  const groups = new Map<string, Raw[]>()
  for (const r of raws) groups.set(r.group, [...(groups.get(r.group) ?? []), r])
  let items: ActivityItem[] = []
  for (const list of groups.values()) {
    const first = list[0]
    if (list.length >= 3 && first.many) {
      const t = Math.max(...list.map((r) => r.t))
      items.push({ id: newId(t), t, at: now, area: first.area, text: first.many(list.length), href: AREA_HREF[first.area] })
    } else {
      for (const r of list) items.push({ id: newId(r.t), t: r.t, at: now, area: r.area, text: r.one, href: r.href ?? AREA_HREF[r.area] })
    }
  }
  items.sort((x, y) => y.t - x.t)
  if (items.length > limit) {
    const rest = items.length - (limit - 1)
    items = [...items.slice(0, limit - 1), { id: newId(now), t: items[limit - 1].t, at: now, area: 'other', text: `made ${rest} more changes` }]
  }
  return items
}

// ---------------------------------------------------------------- unseen tracking

export const SEEN_KEY = 'wp.activitySeen'
export const MAX_ITEMS = 200
export const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

/** Newest first, de-duplicated, capped by count and age. */
export function addToLog(log: ActivityItem[], fresh: ActivityItem[], now = Date.now()): ActivityItem[] {
  const seen = new Set<string>()
  return [...fresh, ...log]
    .filter((x) => now - x.at < MAX_AGE_MS)
    .filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
    .sort((a, b) => b.at - a.at || b.t - a.t)
    .slice(0, MAX_ITEMS)
}

export function unseenCount(log: ActivityItem[], seenAt: number): number {
  return log.filter((x) => x.at > seenAt).length
}
