import { convertAmount, parseMoney } from '../lib/money'
import type { AppState } from '../types'
import { allFields, TEMPLATES } from './taskTemplates'

/** How many stored amounts the plan has (shown before converting). */
export function countAmounts(state: AppState): number {
  let n = state.profile.totalBudget ? 1 : 0
  n += state.quotes.filter((q) => q.amount).length
  for (const l of state.budgetLines) n += [l.estimate, l.quoted, l.actual].filter(Boolean).length
  n += state.payments.filter((p) => p.amount).length
  for (const d of state.taskDetails) {
    const t = TEMPLATES[d.template]
    if (t) n += allFields(t).filter((f) => f.type === 'money' && parseMoney(d.values[f.k])).length
  }
  return n
}

/**
 * Change the plan currency. With a rate, every stored amount is converted (budget, quotes, budget lines,
 * payments, and money fields in task details) so nothing is left in the old currency. Without one, the
 * numbers stay as they are and only the symbol changes (for couples who were already typing euro amounts).
 */
export function switchCurrency(state: AppState, to: 'GBP' | 'EUR', rate: number | null): AppState {
  const from = state.profile.currency ?? 'GBP'
  if (from === to) return state
  const profile = { ...state.profile, currency: to }
  if (!rate || !(rate > 0) || rate === 1) return { ...state, profile }
  const c = (n: number) => convertAmount(n, rate)
  return {
    ...state,
    profile: { ...profile, totalBudget: convertAmount(state.profile.totalBudget, rate, true) },
    quotes: state.quotes.map((q) => (q.amount ? { ...q, amount: c(q.amount) } : q)),
    budgetLines: state.budgetLines.map((l) =>
      l.estimate || l.quoted || l.actual ? { ...l, estimate: c(l.estimate), quoted: c(l.quoted), actual: c(l.actual) } : l,
    ),
    payments: state.payments.map((p) => (p.amount ? { ...p, amount: c(p.amount) } : p)),
    taskDetails: state.taskDetails.map((d) => {
      const t = TEMPLATES[d.template]
      if (!t) return d
      const keys = allFields(t).filter((f) => f.type === 'money' && parseMoney(d.values[f.k])).map((f) => f.k)
      if (!keys.length) return d
      const values = { ...d.values }
      for (const k of keys) values[k] = String(c(parseMoney(values[k])))
      return { ...d, values, updatedAt: new Date().toISOString() }
    }),
  }
}

/** Today's ECB reference rate from Frankfurter (free, no key). Null when offline. */
export async function fetchRate(from: 'GBP' | 'EUR', to: 'GBP' | 'EUR'): Promise<{ rate: number; date: string } | null> {
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`)
    if (!r.ok) return null
    const j = (await r.json()) as { date?: string; rates?: Record<string, number> }
    const rate = j.rates?.[to]
    return rate && rate > 0 ? { rate, date: j.date ?? '' } : null
  } catch {
    return null
  }
}
