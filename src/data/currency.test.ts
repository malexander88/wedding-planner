import { afterEach, describe, expect, it } from 'vitest'
import { emptyState, newSupplier } from '../state/store'
import { gbp, money, moneyExact, parseMoney, setPlanCurrency, withSymbol } from '../lib/money'
import { countAmounts, switchCurrency } from './currency'
import type { AppState } from '../types'

function plan(): AppState {
  const s = emptyState()
  s.profile.totalBudget = 18000
  s.quotes = [{ id: 'q1', supplierId: 'x', label: 'Hire', amount: 4500, vatIncluded: true, vatRate: 20, inclusions: '', exclusions: '', extrasNotes: '', hiddenExtras: {}, validUntil: '', receivedAt: '' }]
  s.budgetLines = [{ id: 'l1', category: 'venue', name: 'Venue', estimate: 0, quoted: 4500, actual: 0, vatIncluded: true, notes: '' }]
  s.payments = [{ id: 'p1', budgetLineId: 'l1', kind: 'deposit', amount: 1000, dueDate: '', paidDate: '2026-11-01', notes: '' }]
  s.taskDetails = [{ id: 'td_x', taskKey: 'legal-notice', template: 'legal-notice', values: { fee: '44', when: '2027-01-01' }, updatedAt: '' }]
  return s
}

afterEach(() => setPlanCurrency('GBP'))

describe('plan currency', () => {
  it('formats couple amounts in the plan currency but official fees always in £', () => {
    setPlanCurrency('EUR')
    expect(money(1200)).toBe('€1,200')
    expect(moneyExact(12.5)).toBe('€12.50')
    expect(gbp(470)).toBe('£470')
    expect(withSymbol('Deposit (£)')).toBe('Deposit (€)')
    setPlanCurrency('GBP')
    expect(money(1200)).toBe('£1,200')
  })
  it('parses typed amounts with either symbol', () => {
    expect(parseMoney('£1,200')).toBe(1200)
    expect(parseMoney('€ 950.505')).toBe(950.51)
    expect(parseMoney('-5')).toBe(0)
    expect(parseMoney('abc')).toBe(0)
  })
  it('counts every stored amount', () => {
    expect(countAmounts(plan())).toBe(5)
  })
  it('converts every stored amount at the rate, so nothing is left in the old currency', () => {
    const out = switchCurrency(plan(), 'EUR', 1.2)
    expect(out.profile.currency).toBe('EUR')
    expect(out.profile.totalBudget).toBe(21600)
    expect(out.quotes[0].amount).toBe(5400)
    expect(out.budgetLines[0].quoted).toBe(5400)
    expect(out.payments[0].amount).toBe(1200)
    expect(out.taskDetails[0].values.fee).toBe('52.8')
    expect(out.taskDetails[0].values.when).toBe('2027-01-01')
  })
  it('relabels without touching numbers when there is no rate', () => {
    const before = plan()
    const out = switchCurrency(before, 'EUR', null)
    expect(out.profile.currency).toBe('EUR')
    expect(out.quotes).toBe(before.quotes)
    expect(out.profile.totalBudget).toBe(18000)
  })
  it('is a no-op when the currency is unchanged', () => {
    const s = plan()
    expect(switchCurrency(s, 'GBP', 1.2)).toBe(s)
  })
  it('round-trips back to pounds', () => {
    const there = switchCurrency(plan(), 'EUR', 1.25)
    const back = switchCurrency(there, 'GBP', 0.8)
    expect(back.profile.totalBudget).toBe(18000)
    expect(back.quotes[0].amount).toBe(4500)
    expect(back.profile.currency).toBe('GBP')
  })
  it('keeps unrelated suppliers untouched', () => {
    const s = plan()
    s.suppliers = [newSupplier({ name: 'X', category: 'venue' })]
    expect(switchCurrency(s, 'EUR', 1.2).suppliers).toBe(s.suppliers)
  })
})
