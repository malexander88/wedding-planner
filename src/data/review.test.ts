import { describe, expect, it } from 'vitest'
import { emptyState, newGuest, newHousehold, newSupplier, reducer } from '../state/store'
import type { AppState } from '../types'
import { isTaskDone, mergeTasks } from './checklist'
import {
  addMonths,
  checkWeddingDate,
  councilFromText,
  daysBetween,
  feeForDate,
  noticeDueDate,
  COUNCILS,
} from './legal'
import { comingUp, reminders } from './taskDetails'
import { venueFee } from './venueFee'

const plan = (date?: string): AppState => {
  const s = emptyState()
  s.profile = { ...s.profile, partnerAName: 'Matt', partnerBName: 'Sam', onboardingComplete: true, date }
  return s
}
const due = (s: AppState, key: string) => mergeTasks(s).find((t) => t.key === key)?.dueDate

describe('dated plan', () => {
  const s = plan('2027-09-04')
  it('save-the-dates go about nine months ahead, well before invitations', () => {
    expect(due(s, 'people-savethedates')).toBe('2026-12-04')
    expect(due(s, 'people-invites')).toBe(noticeDueDate('2027-09-04', false))
    expect(daysBetween(due(s, 'people-savethedates')!, '2027-09-04')).toBeGreaterThanOrEqual(180)
  })
  it('the notice appointment is booked two weeks before notice is given', () => {
    expect(daysBetween(due(s, 'legal-book-appointment')!, due(s, 'legal-give-notice')!)).toBe(14)
  })
  it('addMonths clamps to the end of shorter months', () => {
    expect(addMonths('2027-11-30', -9)).toBe('2027-02-28')
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28')
  })
})

describe('wedding date checks', () => {
  const today = '2026-11-11'
  it('blocks the past, flags under 28 days, warns under 8 weeks', () => {
    expect(checkWeddingDate('2026-11-10', today).level).toBe('past')
    expect(checkWeddingDate('2026-11-30', today).level).toBe('blocked')
    expect(checkWeddingDate('2026-12-20', today).level).toBe('tight')
    expect(checkWeddingDate('2026-12-20', today, true).level).toBe('tight')
    expect(checkWeddingDate('2027-01-15', today, true).level).toBe('tight') // 65 days < 10 weeks
    expect(checkWeddingDate('2027-01-15', today).level).toBe('ok')
  })
})

describe('registrar fees follow the venue’s own council', () => {
  it('works the council out from the place, never from a default', () => {
    expect(councilFromText('Galgorm')).toBe('mea')
    expect(councilFromText('Galgorm Resort, Ballymena')).toBe('mea')
    expect(councilFromText('Belfast')).toBe('belfast')
    expect(councilFromText('Ballyclare')).toBe('anbc')
    expect(councilFromText('Belfast, Antrim & Newtownabbey')).toBeNull()
    expect(councilFromText('Lisburn')).toBe('lcc')
    expect(councilFromText('Enniskillen')).toBe('fodc')
    expect(councilFromText('Somewhere in Donegal')).toBeNull()
  })
  it('uses each band', () => {
    const galgorm = venueFee(newSupplier({ name: 'Galgorm', category: 'venue', area: '' }))
    expect(galgorm.council).toBe('mea')
    expect(feeForDate('2027-10-30', galgorm.band!).amount).toBe(240) // Saturday
    const malone = venueFee(newSupplier({ name: 'Malone House', category: 'venue', area: 'Belfast', catalogueId: 'venue-malone-house' }))
    expect(malone.council).toBe('belfast')
    expect(feeForDate('2027-10-26', malone.band!).amount).toBe(383) // Tuesday
    expect(feeForDate('2027-10-31', COUNCILS.belfast.approved!).amount).toBeNull() // no Sunday ceremonies
    const ballyclare = venueFee(newSupplier({ name: 'Ballyclare Town Hall', category: 'venue', area: 'Ballyclare', catalogueId: 'venue-ballyclare-town-hall' }))
    expect(ballyclare.label).not.toContain('Ballyclare Town Hall')
    const unknown = venueFee(newSupplier({ name: 'The Barn', category: 'venue', area: '' }))
    expect(unknown.band).toBeNull()
    expect(venueFee({ ...newSupplier({ name: 'The Barn', category: 'venue', area: '' }), council: 'belfast' }).council).toBe('belfast')
  })
})

describe('tasks the plan already answers', () => {
  it('choosing a date ticks “Compare a few possible dates”, and unticking sticks', () => {
    let s = plan()
    expect(isTaskDone(s, 'date-compare')).toBe(false)
    s = reducer(s, { type: 'setDate', date: '2027-09-04' })
    expect(isTaskDone(s, 'date-compare')).toBe(true)
    s = reducer(s, { type: 'setTaskDone', key: 'date-compare', done: false })
    expect(isTaskDone(s, 'date-compare')).toBe(false)
  })
  it('older plans with a date already chosen count it as done without writing anything', () => {
    const s = plan('2027-09-04')
    expect(s.taskDone['date-compare']).toBeUndefined()
    expect(mergeTasks(s).find((t) => t.key === 'date-compare')?.done).toBe(true)
    const un = reducer(s, { type: 'setTaskDone', key: 'date-compare', done: false })
    expect(mergeTasks(un).find((t) => t.key === 'date-compare')?.done).toBe(false)
  })
  it('onboarding budget and guest numbers tick the vision tasks', () => {
    const s = emptyState()
    const done = reducer(s, { type: 'completeOnboarding', profile: { ...s.profile, partnerAName: 'A', partnerBName: 'B', totalBudget: 18000, estimatedDayGuests: 90 } })
    expect(done.taskDone['vision-budget']).toBe(true)
    expect(done.taskDone['vision-guests']).toBe(true)
    const noBudget = reducer(s, { type: 'completeOnboarding', profile: { ...s.profile, totalBudget: 0 } })
    expect(noBudget.taskDone['vision-budget']).toBeUndefined()
    const later = reducer(noBudget, { type: 'patchProfile', patch: { totalBudget: 20000 } })
    expect(later.taskDone['vision-budget']).toBe(true)
  })
})

describe('Home coming up', () => {
  it('includes dated tasks, shows the next five even beyond 90 days, and everything within 90', () => {
    const s = plan('2027-09-04')
    const tasks = mergeTasks(s)
    const all = reminders(s, tasks, '2026-11-11', 3650)
    expect(all.some((r) => r.kind === 'task' && r.legal)).toBe(true)
    const shown = comingUp(all, '2026-11-11')
    expect(shown.length).toBe(5)
    expect(shown[0].date >= '2026-11-11').toBe(true)
    const near = plan('2027-01-20')
    const nearAll = reminders(near, mergeTasks(near), '2026-11-11', 3650)
    const within = nearAll.filter((r) => r.date <= '2027-02-09').length
    expect(comingUp(nearAll, '2026-11-11').length).toBe(Math.max(5, within))
  })
})

describe('undo a removed household', () => {
  it('puts the household and its people back in place', () => {
    let s = plan()
    const a = newHousehold('The Smiths')
    const b = newHousehold('The Jones')
    s = reducer(s, { type: 'addHousehold', household: a })
    s = reducer(s, { type: 'addHousehold', household: b })
    const g = newGuest(a.id, 'Ann')
    s = reducer(s, { type: 'addGuest', guest: g })
    const removed = reducer(s, { type: 'removeHousehold', id: a.id })
    expect(removed.guests).toHaveLength(0)
    const back = reducer(removed, { type: 'restoreGuests', household: a, householdIndex: 0, guests: [g], guestIndex: 0 })
    expect(back.households.map((h) => h.name)).toEqual(['The Smiths', 'The Jones'])
    expect(back.guests.map((x) => x.firstName)).toEqual(['Ann'])
  })
})
