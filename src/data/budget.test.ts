import { describe, expect, it } from 'vitest'
import { emptyState } from '../state/store'
import { emptyMeta, makeClock, mergeDocs, stampChanges, type SyncDoc } from '../sync/merge'
import type { AppState, BudgetLine } from '../types'
import { budgetSummary, committedGroups, needsBudgetCleanup, pruneStarterLines } from './budget'

const line = (id: string, category: BudgetLine['category'], name: string, extra: Partial<BudgetLine> = {}): BudgetLine => ({
  id, category, name, estimate: 0, quoted: 0, actual: 0, vatIncluded: true, notes: '', ...extra,
})

/** What the old app seeded for an £18,000 budget (a few of them). */
function oldState(): AppState {
  const s = emptyState()
  s.profile = { ...s.profile, totalBudget: 18000, onboardingComplete: true }
  s.budgetLines = [
    line('s1', 'venue', 'Venue hire', { estimate: 4320 }),
    line('s2', 'catering', 'Wedding breakfast', { estimate: 3960 }),
    line('s3', 'photographer', 'Photographer', { estimate: 1080 }),
    line('s4', 'buffer', 'Contingency (12%)', { estimate: 2160 }),
    line('s5', 'florist', 'Flowers', { estimate: 900 }), // has a payment -> real
    line('s6', 'cake', 'Cake', { estimate: 270, quoted: 350 }), // priced -> real
    line('s7', 'attire', 'Outfits', { estimate: 1440, taskKey: 'details-outfits', quoted: 650 }),
    line('m1', 'other', 'Favours', { estimate: 200 }), // typed by hand -> becomes a £200 cost
    line('m2', 'other', 'New line'), // empty manual line
    line('f1', 'photographer', 'Lens & Light', { supplierId: 'sup1', quoted: 1800, estimate: 1800 }),
  ]
  s.payments = [{ id: 'p1', budgetLineId: 's5', kind: 'deposit', amount: 100, dueDate: '', paidDate: '2026-10-01', notes: 'Florist deposit' }]
  return s
}

describe('pruneStarterLines', () => {
  it('drops untouched starter estimates and keeps everything real', () => {
    const s = pruneStarterLines(oldState())
    expect(s.budgetLines.map((l) => l.id)).toEqual(['s5', 's6', 's7', 'm1', 'f1'])
    expect(s.budgetLines.find((l) => l.id === 'm1')?.quoted).toBe(200)
    expect(needsBudgetCleanup(s)).toBe(false)
    expect(pruneStarterLines(s)).toBe(s) // idempotent, same object
  })
  it('leaves a fresh plan alone', () => {
    const s = emptyState()
    expect(pruneStarterLines(s)).toBe(s)
  })
})

describe('budgetSummary', () => {
  it('committed vs one total, with paid / to pay / left and levels', () => {
    const s = pruneStarterLines(oldState())
    // committed: florist 0, cake 350, outfits 650, favours 200, photographer 1800 = 3000
    expect(budgetSummary(s)).toMatchObject({ total: 18000, committed: 3000, paid: 100, toPay: 2900, left: 15000, level: 'ok' })
    expect(budgetSummary({ ...s, profile: { ...s.profile, totalBudget: 3200 } }).level).toBe('amber')
    expect(budgetSummary({ ...s, profile: { ...s.profile, totalBudget: 2500 } })).toMatchObject({ level: 'over', left: -500 })
    expect(budgetSummary({ ...s, profile: { ...s.profile, totalBudget: 0 } }).level).toBe('none')
  })
  it('groups real entries by category with paid and next due', () => {
    const s = pruneStarterLines(oldState())
    s.payments.push({ id: 'p2', budgetLineId: 'f1', kind: 'balance', amount: 1500, dueDate: '2027-05-01', paidDate: '', notes: '' })
    const g = committedGroups(s)
    expect(g[0]).toMatchObject({ category: 'photographer', total: 1800 })
    expect(g[0].items[0]).toMatchObject({ source: 'supplier', paid: 0 })
    expect(g[0].items[0].nextDue?.id).toBe('p2')
    expect(g.find((x) => x.category === 'florist')?.items[0].paid).toBe(100)
  })
})

describe('cleanup is sync-safe', () => {
  it('the other phone does not bring the starter lines back', () => {
    let t = 1000
    const now = () => t
    // Both phones share the old plan (legacy: no clocks yet).
    const start: SyncDoc = { state: oldState(), meta: emptyMeta() }
    // Phone A runs the cleanup as a normal edit.
    t += 1000
    const next = pruneStarterLines(start.state)
    const { meta } = stampChanges(start.state, next, start.meta, makeClock('A', now))
    const a: SyncDoc = { state: next, meta }
    // Phone B (old version) still has them and merges with A, both ways.
    const b: SyncDoc = structuredClone(start)
    const ab = mergeDocs(b, a, t)
    const ba = mergeDocs(a, b, t)
    for (const m of [ab, ba]) {
      expect(m.state.budgetLines.map((l) => l.id).sort()).toEqual(['f1', 'm1', 's5', 's6', 's7'])
      expect(m.meta.records.budgetLines?.s1?.del).toBe(true)
    }
  })
})
