// Budget = one overall figure. What fills it up is real money only: prices
// agreed in task details, suppliers booked through Find, and costs added by hand.
// No category allocations or estimated splits.

import type { AppState, BudgetLine, Payment } from '../types'
import { categoryLabel } from './categories'

/** Names the old app pre-filled (with % estimates). Used only to clean them up. */
const STARTER_NAMES = new Set([
  'venue|Venue hire',
  'catering|Wedding breakfast',
  'catering|Evening food',
  'photographer|Photographer',
  'videographer|Videographer',
  'attire|Outfits',
  'florist|Flowers',
  'entertainment|Music & entertainment',
  'decor|Decor & hire',
  'cake|Cake',
  'stationery|Stationery',
  'transport|Transport',
  'legal|Notice, registrar & certificates',
  'insurance|Wedding insurance',
])

/** Committed price of a line: what was agreed (or actually spent, if more). */
export function lineCost(l: Pick<BudgetLine, 'quoted' | 'actual'>): number {
  return Math.max(l.quoted || 0, l.actual || 0)
}

/** A pre-filled starter estimate nobody turned into real money. */
export function isStarterLine(line: BudgetLine, payments: Payment[]): boolean {
  if (line.supplierId || line.taskKey) return false
  if (lineCost(line) > 0) return false
  if (payments.some((p) => p.budgetLineId === line.id)) return false
  const seeded =
    STARTER_NAMES.has(`${line.category}|${line.name}`) ||
    (line.category === 'buffer' && /^Contingency \(\d+%\)$/.test(line.name)) ||
    (line.name === 'New line' && !line.estimate)
  return seeded
}

/**
 * Drop untouched starter lines; a hand-added line that only had an estimate
 * becomes a cost at that figure (the couple typed it in). Returns the same
 * object when nothing changes, so it is safe to run repeatedly.
 */
export function pruneStarterLines(state: AppState): AppState {
  let changed = false
  const lines: BudgetLine[] = []
  for (const l of state.budgetLines) {
    if (isStarterLine(l, state.payments)) {
      changed = true
      continue
    }
    if (!lineCost(l) && l.estimate > 0 && !l.supplierId && !l.taskKey && !STARTER_NAMES.has(`${l.category}|${l.name}`) && l.category !== 'buffer') {
      lines.push({ ...l, quoted: l.estimate })
      changed = true
      continue
    }
    lines.push(l)
  }
  return changed ? { ...state, budgetLines: lines } : state
}

export function needsBudgetCleanup(state: AppState): boolean {
  return pruneStarterLines(state) !== state
}

export interface BudgetSummary {
  total: number
  committed: number
  paid: number
  toPay: number
  left: number
  /** committed / total, 0..∞ (0 when no total set) */
  ratio: number
  level: 'ok' | 'amber' | 'over' | 'none'
}

export function budgetSummary(state: Pick<AppState, 'budgetLines' | 'payments' | 'profile'>): BudgetSummary {
  const total = Math.max(0, state.profile.totalBudget || 0)
  const committed = state.budgetLines.reduce((s, l) => s + lineCost(l), 0)
  const paid = state.payments.filter((p) => p.paidDate).reduce((s, p) => s + (p.amount || 0), 0)
  const toPay = Math.max(0, committed - paid)
  const left = total - committed
  const ratio = total > 0 ? committed / total : 0
  const level = total <= 0 ? 'none' : committed > total ? 'over' : ratio >= 0.9 ? 'amber' : 'ok'
  return { total, committed, paid, toPay, left, ratio, level }
}

const EXTRA_LABELS: Record<string, string> = {
  venue: 'Venue',
  legal: 'Legal & registrar',
  insurance: 'Insurance',
  buffer: 'Contingency',
}
export const budgetCategoryLabel = (c: string) => EXTRA_LABELS[c] ?? categoryLabel(c)

export const BUDGET_CATEGORY_OPTIONS: { value: BudgetLine['category']; label: string }[] = [
  'venue', 'catering', 'photographer', 'videographer', 'entertainment', 'florist', 'cake', 'attire', 'hair', 'makeup',
  'transport', 'stationery', 'decor', 'officiant', 'legal', 'insurance', 'planner', 'other',
].map((c) => ({ value: c as BudgetLine['category'], label: budgetCategoryLabel(c) }))

export interface CommittedItem {
  line: BudgetLine
  cost: number
  paid: number
  nextDue?: Payment
  source: 'task' | 'supplier' | 'manual'
}

/** Real entries grouped by category, biggest group first. */
export function committedGroups(state: Pick<AppState, 'budgetLines' | 'payments'>): { category: string; label: string; total: number; items: CommittedItem[] }[] {
  const groups = new Map<string, CommittedItem[]>()
  for (const line of state.budgetLines) {
    const pays = state.payments.filter((p) => p.budgetLineId === line.id)
    const paid = pays.filter((p) => p.paidDate).reduce((s, p) => s + (p.amount || 0), 0)
    const nextDue = pays
      .filter((p) => !p.paidDate && p.amount > 0)
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))[0]
    const item: CommittedItem = {
      line,
      cost: lineCost(line),
      paid,
      nextDue,
      source: line.taskKey ? 'task' : line.supplierId ? 'supplier' : 'manual',
    }
    const key = line.category
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.entries()]
    .map(([category, items]) => ({ category, label: budgetCategoryLabel(category), total: items.reduce((s, i) => s + i.cost, 0), items }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
}
