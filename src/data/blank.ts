// What counts as a "blank" plan: the fresh default the app starts with before
// anything is loaded or entered. A blank plan must never overwrite a real one,
// locally or on the shared server, unless the couple explicitly erased.

import type { AppState } from '../types'

const LISTS = [
  'households', 'guests', 'suppliers', 'quotes', 'budgetLines', 'payments', 'tasks',
  'seatingTables', 'seatingAssignments', 'seatingRules', 'runSheet', 'gifts', 'moodBoard',
  'venueDates', 'taskDetails',
] as const

/** Number of user records in the plan (events are seeded defaults, so not counted). */
export function recordCount(state: Partial<AppState> | null | undefined): number {
  if (!state) return 0
  let n = 0
  for (const k of LISTS) {
    const v = (state as Record<string, unknown>)[k]
    if (Array.isArray(v)) n += v.length
  }
  const done = state.taskDone && typeof state.taskDone === 'object' ? Object.values(state.taskDone).filter(Boolean).length : 0
  return n + done
}

export function isBlankPlan(state: Partial<AppState> | null | undefined): boolean {
  if (!state || typeof state !== 'object') return true
  const p = state.profile
  const named = !!(p && (p.partnerAName?.trim() || p.partnerBName?.trim()))
  return !p?.onboardingComplete && !named && recordCount(state) === 0
}

/** One-line description for backups and messages. */
export function describePlan(state: AppState): string {
  const p = state.profile
  const names = [p.partnerAName, p.partnerBName].filter(Boolean).join(' & ') || 'Unnamed plan'
  const bits = [
    `${state.suppliers?.length ?? 0} suppliers`,
    `${state.guests?.length ?? 0} guests`,
    `${Object.values(state.taskDone ?? {}).filter(Boolean).length} tasks done`,
    `${state.budgetLines?.length ?? 0} costs`,
  ]
  return `${names} · ${bits.join(', ')}`
}
