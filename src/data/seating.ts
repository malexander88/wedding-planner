// Seating plan helpers. Pure: the screen and tests share them.
// Only day guests who are coming are seated (evening-only guests aren't at the meal).
// Dietary notes appear only for guests who gave consent (dietaryOf checks that).

import type { AppState, Guest, Household, SeatingAssignment, SeatingTable } from '../types'
import { dietaryOf, guestName, isComing, isDay } from './guests'

export const seatable = (g: Guest) => isComing(g) && isDay(g)

export interface SeatedGuest {
  guest: Guest
  name: string
  dietary: string
}

export interface TableView {
  table: SeatingTable
  guests: SeatedGuest[]
  free: number
  over: boolean
  /** Households with members at this table and elsewhere. */
  split: string[]
}

export interface WaitingHousehold {
  household: Household | undefined
  id: string
  name: string
  guests: SeatedGuest[]
}

export interface SeatingView {
  tables: TableView[]
  waiting: WaitingHousehold[]
  seated: number
  total: number
  seats: number
}

function seatedGuest(g: Guest, all: Guest[]): SeatedGuest {
  return { guest: g, name: guestName(g, all), dietary: dietaryOf(g) }
}

/** Assignments that still point at a seatable guest and an existing table. */
export function liveAssignments(state: Pick<AppState, 'guests' | 'seatingTables' | 'seatingAssignments'>): Map<string, SeatingAssignment> {
  const tables = new Set(state.seatingTables.map((t) => t.id))
  const guests = new Set(state.guests.filter(seatable).map((g) => g.id))
  const out = new Map<string, SeatingAssignment>()
  for (const a of state.seatingAssignments) if (tables.has(a.tableId) && guests.has(a.guestId)) out.set(a.guestId, a)
  return out
}

export function seatingView(state: Pick<AppState, 'guests' | 'households' | 'seatingTables' | 'seatingAssignments'>): SeatingView {
  const live = liveAssignments(state)
  const people = state.guests.filter(seatable)
  const hhName = (id: string) => state.households.find((h) => h.id === id)?.name || 'Unsorted'

  const tableOfHousehold = new Map<string, Set<string>>()
  for (const g of people) {
    const a = live.get(g.id)
    if (!a) continue
    const set = tableOfHousehold.get(g.householdId) ?? new Set<string>()
    set.add(a.tableId)
    tableOfHousehold.set(g.householdId, set)
  }

  const tables: TableView[] = state.seatingTables.map((table) => {
    const guests = people.filter((g) => live.get(g.id)?.tableId === table.id)
    // Keep households next to each other, in guest-list order.
    const order = new Map<string, number>()
    guests.forEach((g, i) => order.has(g.householdId) || order.set(g.householdId, i))
    guests.sort((a, b) => (order.get(a.householdId)! - order.get(b.householdId)!) || people.indexOf(a) - people.indexOf(b))
    const split = [...new Set(guests.map((g) => g.householdId))].filter((h) => (tableOfHousehold.get(h)?.size ?? 0) > 1 || people.some((p) => p.householdId === h && !live.has(p.id))).map(hhName)
    return { table, guests: guests.map((g) => seatedGuest(g, state.guests)), free: table.seats - guests.length, over: guests.length > table.seats, split }
  })

  const waitingMap = new Map<string, WaitingHousehold>()
  for (const g of people) {
    if (live.has(g.id)) continue
    const w = waitingMap.get(g.householdId) ?? {
      household: state.households.find((h) => h.id === g.householdId),
      id: g.householdId,
      name: hhName(g.householdId),
      guests: [],
    }
    w.guests.push(seatedGuest(g, state.guests))
    waitingMap.set(g.householdId, w)
  }

  return {
    tables,
    waiting: [...waitingMap.values()],
    seated: people.filter((g) => live.has(g.id)).length,
    total: people.length,
    seats: state.seatingTables.reduce((s, t) => s + t.seats, 0),
  }
}

/** Unseated, seatable members of a household (for "seat the household"). */
export function householdToSeat(state: Pick<AppState, 'guests' | 'seatingTables' | 'seatingAssignments'>, householdId: string): string[] {
  const live = liveAssignments(state)
  return state.guests.filter((g) => g.householdId === householdId && seatable(g) && !live.has(g.id)).map((g) => g.id)
}

/** Next free default name: "Table 1", "Table 2", … */
export function nextTableName(tables: SeatingTable[]): string {
  const used = new Set(tables.map((t) => t.name.trim().toLowerCase()))
  for (let i = 1; ; i++) if (!used.has(`table ${i}`)) return `Table ${i}`
}

export const DEFAULT_SEATS: Record<SeatingTable['shape'], number> = { round: 8, rect: 10 }
export const SHAPE_LABEL: Record<SeatingTable['shape'], string> = { round: 'Round', rect: 'Long' }

/** Reducer helper: seat (tableId) or unseat (null) the given guests. */
export function withSeats(assignments: SeatingAssignment[], guestIds: string[], tableId: string | null): SeatingAssignment[] {
  const ids = new Set(guestIds)
  const rest = assignments.filter((a) => !ids.has(a.guestId))
  return tableId ? [...rest, ...guestIds.map((guestId) => ({ guestId, tableId }))] : rest
}

// ---------------------------------------------------------------- export

function esc(v: string): string {
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** Table, guest, household, child, dietary (consent only). No contact details. */
export function seatingCsv(state: AppState): string {
  const v = seatingView(state)
  const rows: string[][] = [['Table', 'Shape', 'Guest', 'Household', 'Child', 'Dietary (with consent)']]
  for (const t of v.tables)
    for (const g of t.guests) rows.push([t.table.name, SHAPE_LABEL[t.table.shape], g.name, state.households.find((h) => h.id === g.guest.householdId)?.name ?? '', g.guest.child ? 'yes' : '', g.dietary])
  for (const w of v.waiting) for (const g of w.guests) rows.push(['(not seated yet)', '', g.name, w.name, g.guest.child ? 'yes' : '', g.dietary])
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}

/** Alphabetical "find your seat" list for printing. */
export function seatFinder(state: Pick<AppState, 'guests' | 'households' | 'seatingTables' | 'seatingAssignments'>): { name: string; table: string }[] {
  const v = seatingView(state)
  return v.tables
    .flatMap((t) => t.guests.map((g) => ({ name: g.name, last: g.guest.lastName || g.name, table: t.table.name })))
    .sort((a, b) => a.last.localeCompare(b.last) || a.name.localeCompare(b.name))
    .map(({ name, table }) => ({ name, table }))
}
