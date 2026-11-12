import { describe, expect, it } from 'vitest'
import { emptyState, newSupplier, reducer } from '../state/store'
import type { AppState } from '../types'
import { parseGuestText, recordsFor, type ParseDefaults } from './guests'
import { householdToSeat, nextTableName, seatFinder, seatingCsv, seatingView } from './seating'
import { addMinutes, dayContacts, defaultRunSheet, shiftRunSheet, sortRunSheet, withDefaults } from './runSheet'
import { budgetBand, buildEnquiry, mailtoUrl } from '../lib/enquiry'

const D: ParseDefaults = { side: 'both', invite: 'day', names: { a: 'Matt', b: 'Sam' } }
function plan(lines = 'Anna & Tom Smith\nCiara & Dan Quinn, kids: Ben, Ella\nMark Doyle (evening)\nJo Black'): AppState {
  const s = emptyState()
  s.profile = { ...s.profile, partnerAName: 'Matt', partnerBName: 'Sam', onboardingComplete: true, date: '2027-06-19', area: 'Antrim' }
  const r = recordsFor(parseGuestText(lines, D))
  return reducer(s, { type: 'addGuests', households: r.households, guests: r.guests })
}
const g = (s: AppState, first: string) => s.guests.find((x) => x.firstName === first)!

describe('seating plan', () => {
  it('seats day guests only, households together, and tracks free seats', () => {
    let s = plan()
    s = reducer(s, { type: 'upsertSeatingTable', table: { id: 't1', name: nextTableName(s.seatingTables), seats: 4, shape: 'round' } })
    expect(s.seatingTables[0].name).toBe('Table 1')
    const v0 = seatingView(s)
    expect(v0.total).toBe(7) // Mark is evening only
    const quinn = g(s, 'Ciara').householdId
    s = reducer(s, { type: 'seatGuests', guestIds: householdToSeat(s, quinn), tableId: 't1' })
    const v1 = seatingView(s)
    expect(v1.tables[0].guests.map((x) => x.name)).toEqual(['Ciara Quinn', 'Dan Quinn', 'Ben Quinn', 'Ella Quinn'])
    expect(v1.tables[0].free).toBe(0)
    expect(v1.waiting.map((w) => w.name)).not.toContain(v1.tables[0].guests[0].guest.householdId)
    expect(v1.seated).toBe(4)
  })

  it('flags over capacity and split households; removing a table or guest frees seats', () => {
    let s = plan()
    s = reducer(s, { type: 'upsertSeatingTable', table: { id: 't1', name: 'Top table', seats: 1, shape: 'rect' } })
    s = reducer(s, { type: 'seatGuests', guestIds: [g(s, 'Anna').id, g(s, 'Jo').id], tableId: 't1' })
    const v = seatingView(s)
    expect(v.tables[0].over).toBe(true)
    expect(v.tables[0].split.length).toBe(1) // Anna is seated, Tom isn't
    s = reducer(s, { type: 'removeGuest', id: g(s, 'Jo').id })
    expect(s.seatingAssignments).toHaveLength(1)
    s = reducer(s, { type: 'removeSeatingTable', id: 't1' })
    expect(s.seatingAssignments).toHaveLength(0)
  })

  it('dietary notes show only with consent, in the view, CSV and nowhere else', () => {
    let s = plan()
    s = reducer(s, { type: 'updateGuest', id: g(s, 'Anna').id, patch: { dietary: 'Vegan', dietaryConsent: true } })
    s = reducer(s, { type: 'updateGuest', id: g(s, 'Tom').id, patch: { dietary: 'Nut allergy', dietaryConsent: false } })
    s = reducer(s, { type: 'upsertSeatingTable', table: { id: 't1', name: 'Table 1', seats: 8, shape: 'round' } })
    s = reducer(s, { type: 'seatGuests', guestIds: [g(s, 'Anna').id, g(s, 'Tom').id], tableId: 't1' })
    const csv = seatingCsv(s)
    expect(csv).toContain('Vegan')
    expect(csv).not.toContain('Nut allergy')
    expect(seatingView(s).tables[0].guests.find((x) => x.name === 'Tom Smith')!.dietary).toBe('')
    expect(seatFinder(s)).toEqual([
      { name: 'Anna Smith', table: 'Table 1' },
      { name: 'Tom Smith', table: 'Table 1' },
    ])
  })

  it('CSV cells that look like formulas are neutralised', () => {
    let s = plan('=HYPERLINK Smith')
    s = reducer(s, { type: 'upsertSeatingTable', table: { id: 't1', name: '+Table', seats: 8, shape: 'round' } })
    expect(seatingCsv(s)).not.toMatch(/(^|,)[=+]/m)
  })
})

describe('run sheet', () => {
  it('builds editable defaults from the ceremony time, with sunset and no supplier details', () => {
    const items = defaultRunSheet({ ceremony: '14:00', sunset: '21:58' })
    const by = (id: string) => items.find((x) => x.id === `rs-d-${id}`)!
    expect(by('ceremony').time).toBe('14:00')
    expect(by('guests').time).toBe('13:30')
    expect(by('meal').time).toBe('16:30')
    expect(by('evening').time).toBe('20:00')
    expect(by('golden').time).toBe('21:13')
    expect(by('carriages').time).toBe('')
    expect(items[items.length - 1].id).toBe('rs-d-carriages')
    expect(items.every((x) => !x.supplierId)).toBe(true)
  })
  it('shifts timed rows, keeps the couple’s rows when adding defaults, and sorts by time', () => {
    const mine = { id: 'mine', time: '13:00', title: 'Florist', owner: '', notes: '' }
    const ceremonyEdited = { id: 'rs-d-ceremony', time: '14:15', title: 'Our vows', owner: 'Us', notes: '' }
    const merged = withDefaults([mine, ceremonyEdited], defaultRunSheet({ ceremony: '14:00' }))
    expect(merged.find((x) => x.id === 'rs-d-ceremony')!.title).toBe('Our vows')
    expect(merged.filter((x) => x.id === 'rs-d-ceremony')).toHaveLength(1)
    const shifted = shiftRunSheet(merged, 30)
    expect(shifted.find((x) => x.id === 'mine')!.time).toBe('13:30')
    expect(shifted.find((x) => x.id === 'rs-d-carriages')!.time).toBe('')
    const golden = shiftRunSheet(defaultRunSheet({ ceremony: '14:00', sunset: '21:58' }), 30).find((x) => x.id === 'rs-d-golden')!
    expect(golden.time).toBe('21:13')
    expect(addMinutes('23:50', 20)).toBe('00:10')
    expect(sortRunSheet([{ ...mine, time: '' }, ceremonyEdited]).map((x) => x.id)).toEqual(['rs-d-ceremony', 'mine'])
  })
  it('collects contacts from booked suppliers and booking details', () => {
    const s = emptyState()
    const band = newSupplier({ name: 'The Band', category: 'entertainment' })
    s.suppliers = [{ ...band, status: 'booked', phone: '028 9000 0000' }, newSupplier({ name: 'Not booked', category: 'cake' })]
    s.taskDetails = [
      { id: 'td1', taskKey: 'x', template: 'booking', values: { supplierName: 'The Band', contactName: 'Lee', email: 'band@example.com' }, updatedAt: '' },
      { id: 'td2', taskKey: 'y', template: 'booking', values: { supplierName: 'Cars Ltd', category: 'transport', phone: '07700 900000' }, updatedAt: '' },
    ]
    const c = dayContacts(s)
    expect(c.map((x) => x.name)).toEqual(['The Band', 'Cars Ltd'])
    expect(c[0]).toMatchObject({ contact: 'Lee', phone: '028 9000 0000', email: 'band@example.com' })
  })
  it('reducer stores the ceremony time and run sheet rows', () => {
    let s = emptyState()
    s = reducer(s, { type: 'setEventStart', id: 'ev_ceremony', start: '13:30' })
    expect(s.events.find((e) => e.id === 'ev_ceremony')!.start).toBe('13:30')
    s = reducer(s, { type: 'setRunSheet', items: defaultRunSheet({ ceremony: '13:30' }) })
    s = reducer(s, { type: 'removeRunItem', id: 'rs-d-cake' })
    expect(s.runSheet.some((x) => x.id === 'rs-d-cake')).toBe(false)
    s = reducer(s, { type: 'setEventStart', id: 'ev_ceremony', start: '' })
    expect('start' in s.events.find((e) => e.id === 'ev_ceremony')!).toBe(false)
  })
})

describe('enquiry drafts', () => {
  it('are category-specific, in three tones, with counts only', () => {
    let s = plan()
    s = reducer(s, { type: 'updateGuest', id: g(s, 'Anna').id, patch: { dietary: 'Coeliac', dietaryConsent: true } })
    const band = newSupplier({ name: 'The Band', category: 'entertainment' })
    const photo = newSupplier({ name: 'Snap', category: 'photographer' })
    const warm = buildEnquiry(s, band, { tone: 'warm', budget: '' })
    expect(warm.body).toMatch(/public liability/)
    expect(warm.body).toContain('Saturday, 19 June 2027')
    expect(warm.body).toContain('8 guests in the evening')
    expect(buildEnquiry(s, photo, { tone: 'warm', budget: '' }).body).toMatch(/second photographer/)
    const brief = buildEnquiry(s, photo, { tone: 'brief', budget: '' })
    expect(brief.body.split('\n').filter((l) => l.startsWith('•'))).toHaveLength(4)
    const formal = buildEnquiry(s, photo, { tone: 'formal', budget: '' })
    expect(formal.body).toMatch(/^Dear Snap team,/)
    expect(formal.body).toMatch(/Kind regards/)
    for (const e of [warm, brief, formal]) for (const secret of ['Anna', 'Smith', 'Coeliac', 'Quinn']) expect(e.body).not.toContain(secret)
  })
  it('mentions a budget band only when given one', () => {
    const s = plan()
    const v = newSupplier({ name: 'Galgorm', category: 'venue' })
    expect(buildEnquiry(s, v, { tone: 'warm', budget: '' }).body).not.toMatch(/budget/i)
    expect(buildEnquiry(s, v, { tone: 'warm', budget: '£8,000–£10,000' }).body).toContain('our budget for this is £8,000–£10,000')
    expect(budgetBand(4500)).toBe('£4,000–£5,000')
    expect(budgetBand(0)).toBe('')
  })
  it('builds a safe mailto link', () => {
    const url = mailtoUrl('hello@venue.co.uk', { subject: 'Hi & bye', body: 'Line 1\nLine 2' })
    expect(url).toBe('mailto:hello@venue.co.uk?subject=Hi%20%26%20bye&body=Line%201%0D%0ALine%202')
    expect(mailtoUrl('bad address?cc=x@y.z', { subject: 'a', body: 'b' })).toMatch(/^mailto:\?subject=/)
  })
})
