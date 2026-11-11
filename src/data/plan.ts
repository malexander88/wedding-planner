// The dated plan: which group a task falls in, filters, and manual ordering. Pure.

import type { Assignee, PlanTask, WeddingProfile } from '../types'
import { addMonths } from './legal'
import { CATALOGUE_INTRODUCED } from './taskCatalogue'

export type PlanGroup = 'overdue' | 'catchup' | 'month' | 'next3' | 'later' | 'anytime' | 'done'

export const GROUPS: { id: PlanGroup; title: string; blurb: string }[] = [
  { id: 'overdue', title: 'Overdue', blurb: 'These dates have passed.' },
  { id: 'catchup', title: 'Catch up', blurb: 'Usually done by now for a wedding on your date — no panic, just worth doing soon.' },
  { id: 'month', title: 'This month', blurb: '' },
  { id: 'next3', title: 'Next 3 months', blurb: '' },
  { id: 'later', title: 'Later', blurb: '' },
  { id: 'anytime', title: 'Any time', blurb: 'No date — give one a date if it matters.' },
  { id: 'done', title: 'Done', blurb: '' },
]

export type PlanFilter = 'all' | 'mine' | 'partner' | 'overdue' | 'done' | 'hidden'

/**
 * Worked-out dates before this day were never shown as deadlines, so missing them isn't "overdue":
 * the later of when the fuller checklist shipped and when the current wedding date was set.
 */
export function catchUpBefore(profile: Pick<WeddingProfile, 'datesFrom'>): string {
  const from = profile.datesFrom ?? ''
  return from > CATALOGUE_INTRODUCED ? from : CATALOGUE_INTRODUCED
}

export function endOfMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

/** A missed worked-out date the couple never saw as a deadline (and hasn't set themselves). */
export function isCatchUp(t: PlanTask, today: string, before: string): boolean {
  return !t.done && !!t.dueDate && t.dueDate < today && !t.strict && !t.dueOverride && t.suggestedDue < (t.graceBefore ?? before)
}

export function groupOf(t: PlanTask, today: string, before: string): PlanGroup {
  if (t.done) return 'done'
  if (!t.dueDate) return 'anytime'
  if (t.dueDate < today) return isCatchUp(t, today, before) ? 'catchup' : 'overdue'
  if (t.dueDate <= endOfMonth(today)) return 'month'
  if (t.dueDate <= addMonths(today, 3)) return 'next3'
  return 'later'
}

const DAY = 86_400_000
const epochDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY)
const FAR = 1e6

export type PlanView = 'date' | 'stage'

/** Sort position: by due date (date view) or catalogue order (stage view), shifted by any manual move. */
export function rankOf(t: PlanTask, view: PlanView): number {
  if (view === 'stage') return t.rankStage ?? t.index
  const base = t.dueDate ? epochDay(t.dueDate) : FAR
  return base + (t.rankDate ?? t.index / 1000)
}

export function sortTasks(tasks: PlanTask[], view: PlanView): PlanTask[] {
  return [...tasks].sort((a, b) => rankOf(a, view) - rankOf(b, view) || a.index - b.index)
}

/** The patch that moves `list[i]` one place up or down within its (already sorted) group. */
export function movePatch(
  list: PlanTask[],
  i: number,
  dir: -1 | 1,
  view: PlanView,
): { key: string; patch: { rankDate?: number; rankStage?: number } } | null {
  const j = i + dir
  if (j < 0 || j >= list.length) return null
  const beyond = list[j + dir]
  const target = rankOf(list[j], view)
  const next = beyond ? (target + rankOf(beyond, view)) / 2 : target + dir
  const t = list[i]
  if (view === 'stage') return { key: t.key, patch: { rankStage: next } }
  const base = t.dueDate ? epochDay(t.dueDate) : FAR
  return { key: t.key, patch: { rankDate: next - base } }
}

export function otherPartner(me: 'a' | 'b'): 'a' | 'b' {
  return me === 'a' ? 'b' : 'a'
}

export function matchesFilter(t: PlanTask, f: PlanFilter, me: 'a' | 'b', today: string, before: string): boolean {
  const gone = !!(t.hidden || t.removed)
  if (f === 'hidden') return gone
  if (gone) return false
  switch (f) {
    case 'mine':
      return t.assignee === me || t.assignee === 'both'
    case 'partner':
      return t.assignee === otherPartner(me) || t.assignee === 'both'
    case 'overdue':
      return groupOf(t, today, before) === 'overdue'
    case 'done':
      return t.done
    default:
      return true
  }
}

/** Tasks in plan groups, in order, with empty groups dropped. */
export function groupTasks(tasks: PlanTask[], today: string, before: string): { group: PlanGroup; tasks: PlanTask[] }[] {
  const by = new Map<PlanGroup, PlanTask[]>()
  for (const t of tasks) {
    const g = groupOf(t, today, before)
    by.set(g, [...(by.get(g) ?? []), t])
  }
  return GROUPS.filter((g) => by.has(g.id)).map((g) => ({ group: g.id, tasks: sortTasks(by.get(g.id)!, 'date') }))
}

/** Home: the next real deadlines (overdue first), skipping catch-up items and hidden ones. */
export function nextDeadlines(tasks: PlanTask[], today: string, before: string, n = 3): PlanTask[] {
  return sortTasks(
    tasks.filter((t) => !t.hidden && !t.removed && !t.done && t.dueDate && !isCatchUp(t, today, before)),
    'date',
  ).slice(0, n)
}

export function assigneeName(a: Assignee | undefined, names: { a: string; b: string }): string {
  if (a === 'a') return names.a
  if (a === 'b') return names.b
  if (a === 'both') return 'Both'
  return ''
}

/** Today on this device, as YYYY-MM-DD. */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
