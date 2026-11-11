import { describe, expect, it } from 'vitest'
import { seedBudget, totals } from './budgetSeeds'
import { emptyState, newSupplier } from '../state/store'
import type { AppState, TaskDetail } from '../types'
import { applyTaskDetail, legalWarnings, reminders } from './taskDetails'
import { summaryLine, TEMPLATES, templateFor } from './taskTemplates'

function plan(): AppState {
  const s = emptyState()
  s.profile = { ...s.profile, date: '2027-08-14', onboardingComplete: true }
  s.budgetLines = seedBudget(18000, 12)
  return s
}
const detail = (taskKey: string, template: TaskDetail['template'], values: Record<string, string>, extra: Partial<TaskDetail> = {}): TaskDetail => ({
  id: `td_${taskKey}`,
  taskKey,
  template,
  values,
  updatedAt: '',
  ...extra,
})

describe('templates', () => {
  it('maps built-in tasks to context templates', () => {
    expect(templateFor({ key: 'book-venue', legal: false }).template.id).toBe('booking')
    expect(templateFor({ key: 'book-venue', legal: false }).preset.category).toBe('venue')
    expect(templateFor({ key: 'legal-give-notice', legal: true }).template.id).toBe('legal-notice')
    expect(templateFor({ key: 'details-outfits', legal: false }).template.id).toBe('purchase')
    expect(templateFor({ key: 'custom_x', legal: false, template: 'admin' }).template.id).toBe('admin')
    expect(templateFor({ key: 'custom_y', legal: false }).template.id).toBe('generic')
  })
  it('summarises a booking', () => {
    const line = summaryLine(TEMPLATES.booking, { supplierName: 'Belfast City Hall', total: '2400', deposit: '500', depositPaidDate: '2026-11-01' })
    expect(line).toBe('Belfast City Hall · £2,400 · deposit paid')
  })
  it('no passport or certificate scan fields anywhere — only ticks', () => {
    for (const t of Object.values(TEMPLATES)) {
      for (const s of t.sections) for (const f of s.fields) {
        if (/passport|birth/i.test(f.label)) expect(f.type).toBe('check')
      }
    }
  })
})

describe('applyTaskDetail', () => {
  it('a venue booking creates the supplier, adopts the seeded venue line and adds deposit + balance', () => {
    const s0 = plan()
    const before = totals(s0)
    const s = applyTaskDetail(
      s0,
      detail('book-venue', 'booking', { category: 'venue', supplierName: 'Belfast City Hall', total: '2400', deposit: '500', depositPaidDate: '2026-11-01', balanceDue: '2027-07-01' }),
      '2026-11-11',
    )
    const venueLines = s.budgetLines.filter((l) => l.category === 'venue')
    expect(venueLines).toHaveLength(1)
    expect(venueLines[0]).toMatchObject({ quoted: 2400, taskKey: 'book-venue' })
    expect(s.budgetLines).toHaveLength(s0.budgetLines.length)
    expect(s.suppliers[0]).toMatchObject({ name: 'Belfast City Hall', status: 'booked' })
    expect(s.profile.venueSupplierId).toBe(s.suppliers[0].id)
    const pays = s.payments.filter((p) => p.taskKey === 'book-venue')
    expect(pays.map((p) => [p.kind, p.amount, p.paidDate, p.dueDate])).toEqual([
      ['deposit', 500, '2026-11-01', '2026-11-01'],
      ['balance', 1900, '', '2027-07-01'],
    ])
    expect(totals(s).estimate).toBe(before.estimate)

    // Re-saving updates in place, ticking balance paid marks it paid.
    const s2 = applyTaskDetail(s, { ...s.taskDetails[0], values: { ...s.taskDetails[0].values, balancePaid: 'true' } }, '2026-12-01')
    expect(s2.payments.filter((p) => p.taskKey === 'book-venue')).toHaveLength(2)
    expect(s2.payments.find((p) => p.kind === 'balance')?.paidDate).toBe('2026-12-01')
    expect(s2.suppliers).toHaveLength(1)
  })

  it('does not double count a supplier already booked through Find', () => {
    const s0 = plan()
    const sup = { ...newSupplier({ name: 'Lens & Light', category: 'photographer' }), id: 'sup1', status: 'booked' as const }
    s0.suppliers = [sup]
    s0.budgetLines = [...s0.budgetLines, { id: 'bl_sup', category: 'photographer', name: 'Lens & Light', estimate: 1800, quoted: 1800, actual: 0, vatIncluded: true, supplierId: 'sup1', notes: '' }]
    s0.payments = [
      { id: 'p1', budgetLineId: 'bl_sup', supplierId: 'sup1', kind: 'deposit', amount: 300, dueDate: '2026-12-01', paidDate: '', notes: 'Deposit — Lens & Light' },
      { id: 'p2', budgetLineId: 'bl_sup', supplierId: 'sup1', kind: 'balance', amount: 1500, dueDate: '2027-07-01', paidDate: '', notes: 'Balance — Lens & Light' },
    ]
    const s = applyTaskDetail(s0, detail('book-photo', 'booking', { category: 'photographer', supplierName: 'Lens & Light', total: '1900', deposit: '300', depositPaidDate: '2026-11-05', balanceDue: '2027-07-01' }, { supplierId: 'sup1' }))
    expect(s.payments).toHaveLength(2)
    expect(s.payments.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(s.payments[0].paidDate).toBe('2026-11-05')
    expect(s.payments[1].amount).toBe(1600)
    expect(s.budgetLines.filter((l) => l.supplierId === 'sup1')).toHaveLength(1)
    expect(s.budgetLines.find((l) => l.id === 'bl_sup')?.quoted).toBe(1900)
  })

  it('removing a deposit removes its payment; vision updates the profile; decision sets the date', () => {
    let s = applyTaskDetail(plan(), detail('details-outfits', 'purchase', { category: 'attire', item: 'Suit', price: '600', deposit: '200' }))
    expect(s.payments.filter((p) => p.taskKey === 'details-outfits')).toHaveLength(2)
    s = applyTaskDetail(s, { ...s.taskDetails[0], values: { ...s.taskDetails[0].values, deposit: '' } })
    expect(s.payments.filter((p) => p.taskKey === 'details-outfits').map((p) => [p.kind, p.amount])).toEqual([['balance', 600]])

    s = applyTaskDetail(s, detail('vision-budget', 'vision', { workingBudget: '22000', dayGuests: '90' }))
    expect(s.profile).toMatchObject({ totalBudget: 22000, estimatedDayGuests: 90 })
    s = applyTaskDetail(s, detail('date-compare', 'decision', { chosenDate: '2027-09-04', useAsDate: 'true' }))
    expect(s.profile.date).toBe('2027-09-04')
  })
})

describe('legalWarnings (wedding 14 Aug 2027)', () => {
  const st = plan()
  it('notice too late is an error, late-ish a warning, on time ok', () => {
    expect(legalWarnings('legal-notice', { noticeDate: '2027-07-30' }, st)[0].level).toBe('error')
    expect(legalWarnings('legal-notice', { noticeDate: '2027-07-01' }, st)[0].level).toBe('warn')
    expect(legalWarnings('legal-notice', { noticeDate: '2027-05-01' }, st)[0].level).toBe('ok')
    expect(legalWarnings('legal-notice', { noticeDate: '2026-07-01' }, st)[0].level).toBe('error')
  })
  it('schedule collection window and return within 3 days', () => {
    expect(legalWarnings('legal-schedule', { collectionDate: '2027-07-20' }, st)[0].level).toBe('error')
    expect(legalWarnings('legal-schedule', { collectionDate: '2027-08-05' }, st)[0].level).toBe('ok')
    const rel = { profile: { ...st.profile, ceremonyType: 'religious' as const } }
    expect(legalWarnings('legal-schedule', { returnDate: '2027-08-20' }, rel).some((w) => w.level === 'error')).toBe(true)
    expect(legalWarnings('legal-schedule', { returnDate: '2027-08-16' }, rel)[0].level).toBe('ok')
  })
  it('two witnesses', () => {
    expect(legalWarnings('legal-witnesses', { witness1: 'Jo' }, st)[0].level).toBe('warn')
  })
  it('asks for a date when there is none', () => {
    const nodate = { profile: { ...st.profile, date: undefined } }
    expect(legalWarnings('legal-notice', { noticeDate: '2027-05-01' }, nodate)[0].level).toBe('info')
  })
})

describe('reminders', () => {
  it('lists unpaid due payments and remind-flagged dates, soonest first', () => {
    let s = applyTaskDetail(plan(), detail('book-venue', 'booking', { category: 'venue', supplierName: 'Hall', total: '2400', deposit: '500', balanceDue: '2027-01-10' }))
    s = applyTaskDetail(s, detail('details-outfits', 'purchase', { item: 'Dress', fitting1: '2026-12-02' }))
    const r = reminders(s, [], '2026-11-11')
    expect(r.map((x) => x.title)).toEqual(['First fitting', 'Balance — Hall'])
  })
})
