import { describe, expect, it } from 'vitest'
import { emptyState, newGuest, newSupplier } from '../state/store'
import type { AppState } from '../types'
import { addToLog, describeRemoteChanges, unseenCount, type ActivityItem } from './activity'
import { emptyMeta, makeClock, stampChanges, type SyncDoc, type SyncMeta } from './merge'

const ME = 'mine'
const THEM = 'theirs'

function base(): AppState {
  const s = emptyState()
  return { ...s, profile: { ...s.profile, partnerAName: 'Matt', partnerBName: 'Sam', onboardingComplete: true } }
}

/** Apply `edit` as if made on device `dev`, returning the new doc. */
function edit(doc: SyncDoc, dev: string, fn: (s: AppState) => AppState, t = 1_700_000_000_000): SyncDoc {
  const next = fn(doc.state)
  const { meta } = stampChanges(doc.state, next, doc.meta, makeClock(dev, () => t))
  return { state: next, meta }
}

function start(): SyncDoc {
  const s = base()
  const m: SyncMeta = emptyMeta()
  return { state: s, meta: m }
}

describe('describeRemoteChanges', () => {
  it('lists the partner’s changes in plain words, newest first', () => {
    const a = start()
    const venue = newSupplier({ name: 'Galgorm', category: 'venue' })
    const b1 = edit(a, THEM, (s) => ({ ...s, suppliers: [...s.suppliers, venue] }), 1000)
    const b2 = edit(b1, THEM, (s) => ({ ...s, profile: { ...s.profile, date: '2027-06-19' } }), 2000)
    const items = describeRemoteChanges(a.state, b2, ME, 5000)
    expect(items.map((i) => i.text)).toEqual(['set the wedding date to Saturday, 19 June 2027', 'shortlisted Galgorm'])
    expect(items[0].t).toBe(2000)
    expect(items[0].at).toBe(5000)
    expect(items[1].href).toBe(`/find/${venue.id}`)
  })

  it('ignores this phone’s own edits', () => {
    const a = start()
    const b = edit(a, ME, (s) => ({ ...s, profile: { ...s.profile, totalBudget: 30000 } }))
    expect(describeRemoteChanges(a.state, b, ME)).toEqual([])
  })

  it('collapses many similar changes and never mentions dietary notes or contacts', () => {
    const a = start()
    const hh = { id: 'h1', name: 'Smith', side: 'a' as const, email: 'x@example.com' }
    const b = edit(a, THEM, (s) => ({
      ...s,
      households: [hh],
      guests: ['Ann', 'Bob', 'Cat', 'Dan'].map((n) => ({ ...newGuest('h1', n), dietary: 'coeliac', dietaryConsent: true })),
    }))
    const text = describeRemoteChanges(a.state, b, ME).map((i) => i.text)
    expect(text).toContain('added 4 guests')
    expect(text).toContain('added the Smith household')
    expect(text.join(' ')).not.toMatch(/coeliac|example\.com/)
  })

  it('reports ticked tasks and a status change to booked', () => {
    const venue = newSupplier({ name: 'Galgorm', category: 'venue' })
    const a = edit(start(), ME, (s) => ({ ...s, suppliers: [venue] }))
    const b = edit(a, THEM, (s) => ({
      ...s,
      suppliers: s.suppliers.map((x) => ({ ...x, status: 'booked' as const })),
      taskDone: { ...s.taskDone, 'book-venue': true },
    }))
    const text = describeRemoteChanges(a.state, b, ME).map((i) => i.text)
    expect(text).toContain('booked Galgorm')
    expect(text.some((t) => t.startsWith('ticked off'))).toBe(true)
  })

  it('a fresh phone joining gets one line, not the whole plan', () => {
    const blank = emptyState()
    const theirs = edit(start(), THEM, (s) => ({ ...s, suppliers: [newSupplier({ name: 'X', category: 'venue' })] }))
    const items = describeRemoteChanges(blank, theirs, ME)
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('shared the plan with this phone')
  })

  it('caps one sync to a short list', () => {
    const a = start()
    const b = edit(a, THEM, (s) => ({
      ...s,
      profile: { ...s.profile, date: '2027-06-19', totalBudget: 25000, area: 'Belfast', style: 'rustic', estimatedDayGuests: 90, estimatedEveningGuests: 30, season: 'summer' },
    }))
    const items = describeRemoteChanges(a.state, b, ME, 1, 4)
    expect(items).toHaveLength(4)
    expect(items[3].text).toBe('made 4 more changes')
  })
})

describe('activity log', () => {
  const item = (id: string, at: number): ActivityItem => ({ id, t: at, at, text: id, area: 'plan' })
  it('keeps newest first, drops duplicates and old entries, counts unseen', () => {
    const now = 100 * 24 * 3600 * 1000
    const log = addToLog([item('old', 1), item('b', now - 10)], [item('c', now), item('b', now - 10)], now)
    expect(log.map((x) => x.id)).toEqual(['c', 'b'])
    expect(unseenCount(log, now - 5)).toBe(1)
  })
})
