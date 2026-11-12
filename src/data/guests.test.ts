import { describe, expect, it } from 'vitest'
import { emptyState, newSupplier, reducer } from '../state/store'
import type { AppState, Guest } from '../types'
import {
  DEFAULT_QUERY,
  guestCounts,
  householdsWithOrphans,
  parseGuestLine,
  parseGuestText,
  planningNumbers,
  queryHouseholds,
  queryPeople,
  recordsFor,
  UNSORTED_ID,
  type ParseDefaults,
} from './guests'
import { addressesCsv, catererCsv, guestsCsv } from '../lib/csv'
import { draftEnquiry } from '../lib/enquiry'
import { emptyMeta, makeClock, mergeDocs, stampChanges, docsEqual, type SyncDoc } from '../sync/merge'

const D: ParseDefaults = { side: 'both', invite: 'day', names: { a: 'Matt', b: 'Sam' } }
const plan = (): AppState => {
  const s = emptyState()
  s.profile = { ...s.profile, partnerAName: 'Matt', partnerBName: 'Sam', onboardingComplete: true }
  return s
}
const withList = (lines: string, d: Partial<ParseDefaults> = {}) => {
  const r = recordsFor(parseGuestText(lines, { ...D, ...d }))
  return reducer(plan(), { type: 'addGuests', households: r.households, guests: r.guests })
}
const byName = (s: AppState, first: string) => s.guests.find((g) => g.firstName === first)!

describe('quick add / bulk paste parsing', () => {
  it('couples share a surname; +1 adds an unnamed plus-one', () => {
    const p = parseGuestLine('Anna & Tom Smith +1', D)!
    expect(p.name).toBe('Anna & Tom Smith')
    expect(p.people).toEqual([
      { first: 'Anna', last: 'Smith', child: false, plusOne: false },
      { first: 'Tom', last: 'Smith', child: false, plusOne: false },
      { first: '', last: '', child: false, plusOne: true },
    ])
  })
  it('different surnames, children, evening, tags', () => {
    expect(parseGuestLine('Anna Jones and Tom Smith', D)!.name).toBe('Anna Jones & Tom Smith')
    const kids = parseGuestLine('Ciara & Dan Quinn, kids: Ben, Ella', D)!
    expect(kids.people.map((p) => `${p.first} ${p.last}${p.child ? ' (child)' : ''}`)).toEqual(['Ciara Quinn', 'Dan Quinn', 'Ben Quinn (child)', 'Ella Quinn (child)'])
    expect(kids.name).toBe('Ciara & Dan Quinn')
    const eve = parseGuestLine('Mark Doyle (evening) #work #five-a-side', D)!
    expect(eve).toMatchObject({ invite: 'evening', tags: ['work', 'five a side'], name: 'Mark Doyle' })
    expect(parseGuestLine('Ollie Grant (8)', D)!.people[0].child).toBe(true)
    expect(parseGuestLine('Jo Black plus one', D)!.people.filter((p) => p.plusOne)).toHaveLength(1)
  })
  it('household-only lines, blanks and comments', () => {
    expect(parseGuestLine('The Murrays', D)).toMatchObject({ name: 'The Murrays', people: [] })
    expect(parseGuestLine('   ', D)).toBeNull()
    expect(parseGuestLine('// cousins', D)).toBeNull()
  })
  it('spreadsheet rows carry side, day/evening and group; a header row is skipped', () => {
    const rows = parseGuestText('Names\tSide\tDay/Evening\tGroup\nAnna Smith\tSam\tEvening\tUni friends\nBen Ross\tMatt\tDay\tWork\tfootball', D)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ side: 'b', invite: 'evening', group: 'Uni friends' })
    expect(rows[1]).toMatchObject({ side: 'a', invite: 'day', group: 'Work', tags: ['football'] })
  })
  it('records link a plus-one to the first adult', () => {
    const r = recordsFor(parseGuestText('Anna & Tom Smith +1', D))
    const plus = r.guests.find((g) => g.isPlusOne)!
    expect(plus.plusOneOfGuestId).toBe(r.guests[0].id)
    expect(r.guests.every((g) => g.householdId === r.households[0].id && g.invitedTo.includes('day'))).toBe(true)
  })
})

describe('counts and planning numbers', () => {
  const s0 = withList('Anna & Tom Smith +1\nCiara & Dan Quinn, kids: Ben, Ella\nMark Doyle (evening)\nJo Black', { side: 'a' })
  it('day, evening-only, children, plus-ones, sides', () => {
    let s = reducer(s0, { type: 'updateGuest', id: byName(s0, 'Jo').id, patch: { rsvp: 'no' } })
    s = reducer(s, { type: 'updateHousehold', id: s.households[1].id, patch: { side: 'b' } })
    const c = guestCounts(s)
    expect(c).toMatchObject({ people: 9, coming: 8, day: 7, eveningOnly: 1, children: 2, plusOnes: 1, unnamedPlusOnes: 1, notComing: 1 })
    expect(c.bySide).toEqual({ a: 4, b: 4, both: 0 })
    expect(c.invitesToSend).toBe(3)
  })
  it('the rest of the app plans with the list once it exists, the first guess before', () => {
    expect(planningNumbers(plan())).toMatchObject({ day: 80, evening: 40, fromList: false })
    expect(planningNumbers(s0)).toMatchObject({ day: 8, evening: 1, children: 2, fromList: true })
  })
  it('supplier enquiry drafts use the counts and never names, addresses or diets', () => {
    let s = reducer(s0, { type: 'updateHousehold', id: s0.households[0].id, patch: { address: '1 Main St, Antrim' } })
    s = reducer(s, { type: 'updateGuest', id: byName(s, 'Anna').id, patch: { dietaryConsent: true, dietary: 'Coeliac' } })
    const text = draftEnquiry(s, newSupplier({ name: 'Galgorm', category: 'venue' }))
    expect(text).toContain('8 day guests and 1 extra evening guests, including 2 children')
    for (const secret of ['Anna', 'Smith', 'Main St', 'Coeliac']) expect(text).not.toContain(secret)
  })
})

describe('invitation ticks (manual, no RSVP)', () => {
  it('ticking stamps the date; unticking clears it; bulk marks only the given households', () => {
    const s0 = withList('A One\nB Two\nC Three')
    let s = reducer(s0, { type: 'updateHousehold', id: s0.households[0].id, patch: { inviteSent: true } })
    expect(s.households[0].inviteSentOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    s = reducer(s, { type: 'updateHousehold', id: s0.households[0].id, patch: { inviteSent: false } })
    expect(s.households[0].inviteSentOn).toBeUndefined()
    s = reducer(s, { type: 'setInvitesSent', ids: [s0.households[1].id, s0.households[2].id], sent: true })
    expect(guestCounts(s)).toMatchObject({ invitesSent: 2, invitesToSend: 1 })
    expect(reducer(s, { type: 'setInvitesSent', ids: [s0.households[1].id], sent: true })).toBe(s)
  })
  it('no-op edits do not write', () => {
    const s = withList('A One')
    expect(reducer(s, { type: 'updateHousehold', id: s.households[0].id, patch: { name: 'A One' } })).toBe(s)
    expect(reducer(s, { type: 'updateGuest', id: s.guests[0].id, patch: { firstName: 'A' } })).toBe(s)
  })
})

describe('dietary needs need consent', () => {
  it('are never stored without the consent tick, and unticking clears them', () => {
    let s = withList('Ann Lee')
    const id = s.guests[0].id
    s = reducer(s, { type: 'updateGuest', id, patch: { dietary: 'Nut allergy' } })
    expect(s.guests[0].dietary).toBe('')
    s = reducer(s, { type: 'updateGuest', id, patch: { dietaryConsent: true, dietary: 'Nut allergy' } })
    expect(s.guests[0].dietary).toBe('Nut allergy')
    expect(guestCounts(s).dietary).toBe(1)
    s = reducer(s, { type: 'updateGuest', id, patch: { dietaryConsent: false } })
    expect(s.guests[0].dietary).toBe('')
    const added = reducer(plan(), { type: 'addGuests', households: [], guests: [{ ...s.guests[0], id: 'g2', dietary: 'Vegan', dietaryConsent: false }] })
    expect(added.guests[0].dietary).toBe('')
  })
  it('an old note held without consent is hidden from counts and exports until confirmed', () => {
    const s = withList('Ann Lee')
    s.guests[0] = { ...s.guests[0], dietary: 'Coeliac', dietaryConsent: false }
    expect(guestCounts(s)).toMatchObject({ dietary: 0, heldWithoutConsent: 1 })
    expect(guestsCsv(s)).not.toContain('Coeliac')
    expect(catererCsv(s)).not.toContain('Coeliac')
    // Editing something else leaves it for the couple to decide.
    const t = reducer(s, { type: 'updateGuest', id: s.guests[0].id, patch: { meal: 'Fish' } })
    expect(t.guests[0].dietary).toBe('Coeliac')
  })
})

describe('exports', () => {
  const s0 = (() => {
    let s = withList('Anna & Tom Smith\n=HYPERLINK("x") Evil')
    s = reducer(s, { type: 'updateHousehold', id: s.households[0].id, patch: { address: '1 Main St', postcode: 'BT1 1AA', email: 'a@x.com' } })
    s = reducer(s, { type: 'updateGuest', id: byName(s, 'Tom').id, patch: { rsvp: 'no' } })
    return s
  })()
  it('contact details only when asked; no RSVP column', () => {
    const plain = guestsCsv(s0)
    expect(plain).not.toContain('Main St')
    expect(plain).not.toContain('a@x.com')
    expect(plain.split('\n')[0]).not.toMatch(/rsvp/i)
    expect(guestsCsv(s0, { contacts: true })).toContain('1 Main St')
    expect(addressesCsv(s0)).toContain('BT1 1AA')
  })
  it('caterer list leaves out people who can’t come and contact details', () => {
    const c = catererCsv(s0)
    expect(c).toContain('Anna Smith')
    expect(c).not.toContain('Tom Smith')
    expect(c).not.toContain('Main St')
  })
  it('cells that look like formulas are neutralised', () => {
    expect(guestsCsv(s0)).not.toMatch(/(^|,)=HYPERLINK/m)
  })
})

describe('search, filter and sort', () => {
  const s0 = (() => {
    let s = withList('Anna & Tom Smith #uni\nZoe Adams (evening)\nCiara Quinn, kids: Ben', { side: 'a' })
    s = reducer(s, { type: 'updateHousehold', id: s.households[1].id, patch: { side: 'b', group: 'Work' } })
    return s
  })()
  const names = (rows: ReturnType<typeof queryHouseholds>) => rows.map((r) => r.household.name)
  it('search matches people, tags and groups', () => {
    expect(names(queryHouseholds(s0, { ...DEFAULT_QUERY, q: 'tom' }))).toEqual(['Anna & Tom Smith'])
    expect(queryHouseholds(s0, { ...DEFAULT_QUERY, q: 'tom' })[0].guests.map((g) => g.firstName)).toEqual(['Tom'])
    expect(names(queryHouseholds(s0, { ...DEFAULT_QUERY, q: 'uni' }))).toEqual(['Anna & Tom Smith'])
    expect(names(queryHouseholds(s0, { ...DEFAULT_QUERY, q: 'work' }))).toEqual(['Zoe Adams'])
  })
  it('filters by side, day/evening, status and tag', () => {
    expect(names(queryHouseholds(s0, { ...DEFAULT_QUERY, side: 'b' }))).toEqual(['Zoe Adams'])
    expect(names(queryHouseholds(s0, { ...DEFAULT_QUERY, invite: 'evening' }))).toEqual(['Zoe Adams'])
    const kids = queryHouseholds(s0, { ...DEFAULT_QUERY, status: 'children' })
    expect(kids.map((r) => r.guests.map((g) => g.firstName))).toEqual([['Ben']])
    expect(queryHouseholds(s0, { ...DEFAULT_QUERY, tag: 'uni' })[0].guests).toHaveLength(2)
    expect(queryHouseholds(s0, { ...DEFAULT_QUERY, status: 'toInvite' })).toHaveLength(3)
  })
  it('sorts households and people', () => {
    expect(names(queryHouseholds(s0, { ...DEFAULT_QUERY, sort: 'name' }))).toEqual(['Anna & Tom Smith', 'Ciara Quinn', 'Zoe Adams'])
    expect(names(queryHouseholds(s0, { ...DEFAULT_QUERY, sort: 'surname' }))).toEqual(['Zoe Adams', 'Ciara Quinn', 'Anna & Tom Smith'])
    expect(names(queryHouseholds(s0, { ...DEFAULT_QUERY, sort: 'side' }))[2]).toBe('Zoe Adams')
    expect(queryPeople(s0, { ...DEFAULT_QUERY, sort: 'surname' }).map((p) => p.guest.firstName)).toEqual(['Zoe', 'Ben', 'Ciara', 'Anna', 'Tom'])
  })
})

function device(name: string, start: SyncDoc, time: { now: () => number }) {
  const tick = makeClock(name, time.now)
  let doc: SyncDoc = structuredClone(start)
  return {
    get doc() {
      return doc
    },
    act(fn: (s: AppState) => AppState) {
      const next = fn(structuredClone(doc.state))
      doc = { state: next, meta: stampChanges(doc.state, next, doc.meta, tick).meta }
    },
  }
}

describe('sync: guests and households merge per field', () => {
  const setup = () => {
    let t = 1000
    const time = { now: () => t, advance: () => (t += 1000) }
    const a = device('a', { state: plan(), meta: emptyMeta() }, time)
    a.act(() => withList('Anna & Tom Smith'))
    time.advance()
    const b = device('b', a.doc, time)
    return { a, b, time }
  }
  it('two phones editing different fields of one guest both stick', () => {
    const { a, b, time } = setup()
    const id = byName(a.doc.state, 'Anna').id
    a.act((s) => reducer(s, { type: 'updateGuest', id, patch: { meal: 'Fish' } }))
    time.advance()
    b.act((s) => reducer(s, { type: 'updateGuest', id, patch: { lastName: 'Smyth', tags: ['uni'] } }))
    const ab = mergeDocs(a.doc, b.doc, time.now())
    expect(ab.state.guests.find((g) => g.id === id)).toMatchObject({ meal: 'Fish', lastName: 'Smyth', tags: ['uni'] })
    expect(docsEqual(ab, mergeDocs(b.doc, a.doc, time.now()))).toBe(true)
  })
  it('one phone ticks the invitation while the other adds the address', () => {
    const { a, b, time } = setup()
    const id = a.doc.state.households[0].id
    a.act((s) => reducer(s, { type: 'updateHousehold', id, patch: { inviteSent: true } }))
    time.advance()
    b.act((s) => reducer(s, { type: 'updateHousehold', id, patch: { address: '1 Main St', side: 'b' } }))
    const m = mergeDocs(a.doc, b.doc, time.now())
    expect(m.state.households[0]).toMatchObject({ inviteSent: true, address: '1 Main St', side: 'b' })
  })
  it('a household removed on one phone while the other adds someone: nobody is lost', () => {
    const { a, b, time } = setup()
    const hh = a.doc.state.households[0].id
    a.act((s) => reducer(s, { type: 'removeHousehold', id: hh }))
    time.advance()
    const late: Guest = { ...b.doc.state.guests[0], id: 'g_late', firstName: 'Late' }
    b.act((s) => reducer(s, { type: 'addGuest', guest: late }))
    const m = mergeDocs(a.doc, b.doc, time.now())
    expect(m.state.guests.map((g) => g.firstName)).toEqual(['Late'])
    expect(householdsWithOrphans(m.state).at(-1)?.id).toBe(UNSORTED_ID)
    expect(queryHouseholds(m.state, DEFAULT_QUERY).at(-1)?.guests[0].firstName).toBe('Late')
  })
})
