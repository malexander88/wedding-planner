import type { AppState, BudgetLine } from '../types'
import { uid } from '../lib/ids'

const SHARES: { category: BudgetLine['category']; name: string; share: number }[] = [
  { category: 'venue', name: 'Venue hire', share: 0.24 },
  { category: 'catering', name: 'Wedding breakfast', share: 0.22 },
  { category: 'catering', name: 'Evening food', share: 0.08 },
  { category: 'photographer', name: 'Photographer', share: 0.06 },
  { category: 'videographer', name: 'Videographer', share: 0.06 },
  { category: 'attire', name: 'Outfits', share: 0.08 },
  { category: 'florist', name: 'Flowers', share: 0.05 },
  { category: 'entertainment', name: 'Music & entertainment', share: 0.06 },
  { category: 'decor', name: 'Decor & hire', share: 0.04 },
  { category: 'cake', name: 'Cake', share: 0.015 },
  { category: 'stationery', name: 'Stationery', share: 0.015 },
  { category: 'transport', name: 'Transport', share: 0.025 },
  { category: 'legal', name: 'Notice, registrar & certificates', share: 0.015 },
  { category: 'insurance', name: 'Wedding insurance', share: 0.01 },
]

export function seedBudget(total: number, bufferPercent: number): BudgetLine[] {
  const working = Math.max(0, total)
  const lines: BudgetLine[] = SHARES.map((s) => ({
    id: uid('bl'),
    category: s.category,
    name: s.name,
    estimate: Math.round(working * s.share),
    quoted: 0,
    actual: 0,
    vatIncluded: true,
    notes: '',
  }))
  lines.push({
    id: uid('bl'),
    category: 'buffer',
    name: `Contingency (${bufferPercent}%)`,
    estimate: Math.round(working * (bufferPercent / 100)),
    quoted: 0,
    actual: 0,
    vatIncluded: true,
    notes: 'For extras that often catch couples out: VAT surprises, corkage, overtime, supplier meals.',
  })
  return lines
}

export function totals(state: Pick<AppState, 'budgetLines' | 'payments'>) {
  const estimate = state.budgetLines.reduce((s, l) => s + (l.estimate || 0), 0)
  const quoted = state.budgetLines.reduce((s, l) => s + (l.quoted || 0), 0)
  const actual = state.budgetLines.reduce((s, l) => s + (l.actual || 0), 0)
  const paid = state.payments
    .filter((p) => p.paidDate)
    .reduce((s, p) => s + (p.amount || 0), 0)
  const due = state.payments
    .filter((p) => !p.paidDate)
    .reduce((s, p) => s + (p.amount || 0), 0)
  return { estimate, quoted, actual, paid, due }
}
