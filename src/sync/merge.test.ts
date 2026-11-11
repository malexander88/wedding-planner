import { describe, expect, it } from 'vitest'
import { emptyState, newGuest, newHousehold, newSupplier } from '../state/store'
import type { AppState, Supplier } from '../types'
import {
  TOMBSTONE_TTL_MS,
  compareClock,
  docsEqual,
  emptyMeta,
  fromWire,
  makeClock,
  mergeDocs,
  stableStringify,
  stampChanges,
  toWire,
  type SyncDoc,
} from './merge'

function fakeTime(start = 1_000) {
  let t = start
  return { now: () => t, advance: (ms = 1000) => (t += ms) }
}

function base(): AppState {
  const s = emptyState()
  s.updatedAt = '2026-01-01T00:00:00.000Z'
  s.profile = { ...s.profile, partnerAName: 'Matt', partnerBName: 'Sam', onboardingComplete: true }
  return s
}

/** A tiny device simulator: edits go through stampChanges like the app does. */
function device(name: string, start: SyncDoc, time: { now: () => number }) {
  const tick = makeClock(name, time.now)
  let doc: SyncDoc = structuredClone(start)
  return {
    get doc() {
      return doc
    },
    edit(fn: (s: AppState) => AppState) {
      const next = fn(structuredClone(doc.state))
      const { meta } = stampChanges(doc.state, next, doc.meta, tick)
      doc = { state: next, meta }
    },
    absorb(remote: SyncDoc) {
      doc = mergeDocs(doc, remote, time.now())
    },
  }
}

const sup = (id: string, name: string, extra: Partial<Supplier> = {}): Supplier => ({
  ...newSupplier({ name, category: 'venue' }),
  id,
  addedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
})

describe('stableStringify / clocks', () => {
  it('ignores key order and undefined', () => {
    expect(stableStringify({ b: 1, a: [1, { y: 2, x: undefined }] })).toBe(stableStringify({ a: [1, { y: 2 }], b: 1 }))
  })
  it('makeClock is monotonic even if the wall clock stalls', () => {
    const tick = makeClock('d1', () => 5)
    const a = tick()
    const b = tick()
    expect(compareClock(b, a)).toBe(1)
  })
  it('ties break on device id', () => {
    expect(compareClock({ t: 1, d: 'a' }, { t: 1, d: 'b' })).toBe(-1)
  })
})

describe('stampChanges', () => {
  it('stamps adds, edits and deletes, and ignores unchanged records and updatedAt', () => {
    const tick = makeClock('dev', fakeTime().now)
    const s0 = base()
    s0.suppliers = [sup('s1', 'Barn'), sup('s2', 'Castle')]
    const s1: AppState = {
      ...s0,
      updatedAt: '2026-02-02T00:00:00.000Z',
      suppliers: [{ ...s0.suppliers[0], notes: 'lovely' }, sup('s3', 'Hotel')],
    }
    const { meta, changed } = stampChanges(s0, s1, emptyMeta(), tick)
    expect(changed).toBe(true)
    expect(Object.keys(meta.records.suppliers).sort()).toEqual(['s1', 's2', 's3'])
    expect(meta.records.suppliers.s2.del).toBe(true)
    expect(meta.records.suppliers.s1.del).toBeUndefined()

    const again = stampChanges(s1, { ...s1, updatedAt: 'x', suppliers: s1.suppliers.map((s) => ({ ...s })) }, meta, tick)
    expect(again.changed).toBe(false)
    expect(again.meta).toBe(meta)
  })

  it('stamps profile and taskDone per field', () => {
    const tick = makeClock('dev', fakeTime().now)
    const s0 = base()
    const s1 = { ...s0, profile: { ...s0.profile, totalBudget: 20000 }, taskDone: { 'vision-budget': true } }
    const { meta } = stampChanges(s0, s1, emptyMeta(), tick)
    expect(Object.keys(meta.fields.profile)).toEqual(['totalBudget'])
    expect(Object.keys(meta.fields.taskDone)).toEqual(['vision-budget'])
  })

  it('stamps clearing an optional profile field (date) as a change', () => {
    const tick = makeClock('dev', fakeTime().now)
    const s0 = base()
    s0.profile.date = '2027-06-12'
    const s1 = { ...s0, profile: { ...s0.profile, date: undefined } }
    const { meta, changed } = stampChanges(s0, s1, emptyMeta(), tick)
    expect(changed).toBe(true)
    expect(meta.fields.profile.date).toBeDefined()
  })
})

describe('mergeDocs', () => {
  it('keeps records added on both phones', () => {
    const time = fakeTime()
    const start: SyncDoc = { state: base(), meta: emptyMeta() }
    const a = device('A', start, time)
    const b = device('B', start, time)
    a.edit((s) => ({ ...s, suppliers: [...s.suppliers, sup('sa', 'Barn')] }))
    time.advance()
    b.edit((s) => ({ ...s, suppliers: [...s.suppliers, sup('sb', 'Castle')] }))
    const m = mergeDocs(a.doc, b.doc)
    expect(m.state.suppliers.map((s) => s.id).sort()).toEqual(['sa', 'sb'])
  })

  it('last writer wins per record, other records untouched', () => {
    const time = fakeTime()
    const s = base()
    s.suppliers = [sup('s1', 'Barn'), sup('s2', 'Castle')]
    const start: SyncDoc = { state: s, meta: emptyMeta() }
    const a = device('A', start, time)
    const b = device('B', start, time)
    a.edit((x) => ({ ...x, suppliers: x.suppliers.map((r) => (r.id === 's1' ? { ...r, notes: 'A note' } : r)) }))
    time.advance()
    b.edit((x) => ({ ...x, suppliers: x.suppliers.map((r) => (r.id === 's1' ? { ...r, notes: 'B note' } : r)) }))
    b.edit((x) => ({ ...x, suppliers: x.suppliers.map((r) => (r.id === 's2' ? { ...r, status: 'enquired' } : r)) }))
    const m = mergeDocs(a.doc, b.doc)
    expect(m.state.suppliers.find((r) => r.id === 's1')?.notes).toBe('B note')
    expect(m.state.suppliers.find((r) => r.id === 's2')?.status).toBe('enquired')
  })

  it('a delete beats an older edit and is not resurrected', () => {
    const time = fakeTime()
    const s = base()
    s.suppliers = [sup('s1', 'Barn')]
    const start: SyncDoc = { state: s, meta: emptyMeta() }
    const a = device('A', start, time)
    const b = device('B', start, time)
    a.edit((x) => ({ ...x, suppliers: x.suppliers.map((r) => ({ ...r, notes: 'edited first' })) }))
    time.advance()
    b.edit((x) => ({ ...x, suppliers: [] }))
    const m1 = mergeDocs(a.doc, b.doc, time.now())
    const m2 = mergeDocs(b.doc, a.doc, time.now())
    expect(m1.state.suppliers).toEqual([])
    expect(m2.state.suppliers).toEqual([])
    expect(m1.meta.records.suppliers.s1.del).toBe(true)
  })

  it('an edit made after a delete wins (the record comes back)', () => {
    const time = fakeTime()
    const s = base()
    s.suppliers = [sup('s1', 'Barn')]
    const start: SyncDoc = { state: s, meta: emptyMeta() }
    const a = device('A', start, time)
    const b = device('B', start, time)
    b.edit((x) => ({ ...x, suppliers: [] }))
    time.advance()
    a.edit((x) => ({ ...x, suppliers: x.suppliers.map((r) => ({ ...r, notes: 'still keen' })) }))
    expect(mergeDocs(a.doc, b.doc).state.suppliers[0]?.notes).toBe('still keen')
  })

  it('merges profile fields independently', () => {
    const time = fakeTime()
    const start: SyncDoc = { state: base(), meta: emptyMeta() }
    const a = device('A', start, time)
    const b = device('B', start, time)
    a.edit((x) => ({ ...x, profile: { ...x.profile, totalBudget: 22000 } }))
    time.advance()
    b.edit((x) => ({ ...x, profile: { ...x.profile, area: 'Lisburn' } }))
    const m = mergeDocs(a.doc, b.doc)
    expect(m.state.profile.totalBudget).toBe(22000)
    expect(m.state.profile.area).toBe('Lisburn')
    expect(m.state.profile.partnerAName).toBe('Matt')
  })

  it('merges ticked tasks per key', () => {
    const time = fakeTime()
    const start: SyncDoc = { state: base(), meta: emptyMeta() }
    const a = device('A', start, time)
    const b = device('B', start, time)
    a.edit((x) => ({ ...x, taskDone: { ...x.taskDone, one: true } }))
    time.advance()
    b.edit((x) => ({ ...x, taskDone: { ...x.taskDone, two: true } }))
    expect(mergeDocs(a.doc, b.doc).state.taskDone).toEqual({ one: true, two: true })
  })

  it('handles id-less lists by natural key (venueDates, seatingAssignments)', () => {
    const time = fakeTime()
    const start: SyncDoc = { state: base(), meta: emptyMeta() }
    const a = device('A', start, time)
    const b = device('B', start, time)
    a.edit((x) => ({ ...x, venueDates: [{ supplierId: 's1', date: '2027-06-12', availability: 'hold' }] }))
    time.advance()
    b.edit((x) => ({
      ...x,
      venueDates: [
        { supplierId: 's1', date: '2027-06-12', availability: 'available' },
        { supplierId: 's1', date: '2027-06-19', availability: 'unavailable' },
      ],
      seatingAssignments: [{ guestId: 'g1', tableId: 't1' }],
    }))
    const m = mergeDocs(a.doc, b.doc)
    expect(m.state.venueDates).toHaveLength(2)
    expect(m.state.venueDates.find((v) => v.date === '2027-06-12')?.availability).toBe('available')
    expect(m.state.seatingAssignments).toEqual([{ guestId: 'g1', tableId: 't1' }])
  })

  it('is symmetric for legacy data with no clocks (both phones converge)', () => {
    const a = base()
    const b = base()
    a.suppliers = [sup('s1', 'Barn', { notes: 'from A' })]
    b.suppliers = [sup('s1', 'Barn', { notes: 'from B' }), sup('s2', 'Castle')]
    const da: SyncDoc = { state: a, meta: emptyMeta() }
    const db: SyncDoc = { state: b, meta: emptyMeta() }
    const ab = mergeDocs(da, db)
    const ba = mergeDocs(db, da)
    expect(stableStringify(ab.state.suppliers.toSorted((x, y) => x.id.localeCompare(y.id)))).toBe(
      stableStringify(ba.state.suppliers.toSorted((x, y) => x.id.localeCompare(y.id))),
    )
  })

  it('is idempotent', () => {
    const time = fakeTime()
    const start: SyncDoc = { state: base(), meta: emptyMeta() }
    const a = device('A', start, time)
    a.edit((x) => ({ ...x, suppliers: [sup('s1', 'Barn')] }))
    const m = mergeDocs(a.doc, a.doc)
    expect(docsEqual(m, a.doc)).toBe(true)
    expect(docsEqual(mergeDocs(m, m), m)).toBe(true)
  })

  it('drops tombstones older than the TTL but keeps recent ones', () => {
    const time = fakeTime(10)
    const s = base()
    s.suppliers = [sup('old', 'Old'), sup('new', 'New')]
    const a = device('A', { state: s, meta: emptyMeta() }, time)
    a.edit((x) => ({ ...x, suppliers: x.suppliers.filter((r) => r.id !== 'old') }))
    time.advance(TOMBSTONE_TTL_MS + 1)
    a.edit((x) => ({ ...x, suppliers: [] }))
    const m = mergeDocs(a.doc, { state: base(), meta: emptyMeta() }, time.now())
    expect(m.meta.records.suppliers.old).toBeUndefined()
    expect(m.meta.records.suppliers.new.del).toBe(true)
  })

  it('round-trips the wire format and rejects foreign JSON', () => {
    const doc: SyncDoc = { state: base(), meta: emptyMeta() }
    expect(docsEqual(fromWire(JSON.parse(JSON.stringify(toWire(doc))))!, doc)).toBe(true)
    expect(fromWire({})).toBeNull()
    expect(fromWire({ schema: 'other', state: base() })).toBeNull()
  })
})

describe('two phones syncing through the server', () => {
  // Server with optimistic concurrency, mirroring put_state in 001_sync.sql.
  function server(initial: SyncDoc) {
    let row = { version: 1, doc: structuredClone(initial) }
    return {
      get: () => structuredClone(row),
      conflicts: 0,
      put(doc: SyncDoc, baseVersion: number) {
        if (baseVersion !== row.version) {
          this.conflicts++
          return { ok: false as const, ...structuredClone(row) }
        }
        row = { version: row.version + 1, doc: structuredClone(doc) }
        return { ok: true as const, version: row.version }
      },
    }
  }

  function sync(dev: ReturnType<typeof device>, srv: ReturnType<typeof server>) {
    let remote = srv.get()
    for (let i = 0; i < 5; i++) {
      dev.absorb(remote.doc)
      const res = srv.put(dev.doc, remote.version)
      if (res.ok) return
      remote = res
    }
    throw new Error('did not converge')
  }

  it.each([42, 7, 1234, 99, 2026, 31337])('converges after random concurrent edits, deletes and conflicts (seed %i)', (initialSeed) => {
    let seed = initialSeed
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    const time = fakeTime()
    const hh = newHousehold('The Murrays')
    const start: SyncDoc = { state: { ...base(), households: [hh] }, meta: emptyMeta() }
    const srv = server(start)
    const a = device('A', start, time)
    const b = device('B', start, time)
    const devs = [a, b]
    let n = 0

    for (let step = 0; step < 400; step++) {
      time.advance(Math.floor(rand() * 2000))
      const d = devs[rand() < 0.5 ? 0 : 1]
      const r = rand()
      if (r < 0.25) {
        const g = { ...newGuest(hh.id, `Guest${n}`), id: `g${n++}` }
        d.edit((s) => ({ ...s, guests: [...s.guests, g] }))
      } else if (r < 0.45) {
        d.edit((s) => {
          if (!s.guests.length) return s
          const victim = s.guests[Math.floor(rand() * s.guests.length)]
          return { ...s, guests: s.guests.map((g) => (g.id === victim.id ? { ...g, meal: `meal${step}` } : g)) }
        })
      } else if (r < 0.55) {
        d.edit((s) => {
          if (!s.guests.length) return s
          const victim = s.guests[Math.floor(rand() * s.guests.length)]
          return { ...s, guests: s.guests.filter((g) => g.id !== victim.id) }
        })
      } else if (r < 0.65) {
        d.edit((s) => ({ ...s, profile: { ...s.profile, totalBudget: 15000 + step } }))
      } else if (r < 0.75) {
        d.edit((s) => ({ ...s, taskDone: { ...s.taskDone, [`t${step % 7}`]: rand() < 0.5 } }))
      } else {
        sync(d, srv)
      }
    }
    sync(a, srv)
    sync(b, srv)
    sync(a, srv)

    expect(docsEqual(a.doc, b.doc)).toBe(true)
    expect(docsEqual(a.doc, srv.get().doc)).toBe(true)
    expect(srv.get().version).toBeGreaterThan(10)
    const ids = a.doc.state.guests.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('retries after a version conflict and keeps both phones\' edits', () => {
    const time = fakeTime()
    const start: SyncDoc = { state: base(), meta: emptyMeta() }
    const srv = server(start)
    const a = device('A', start, time)
    const b = device('B', start, time)
    a.edit((x) => ({ ...x, suppliers: [sup('sa', 'Barn')] }))
    time.advance()
    b.edit((x) => ({ ...x, profile: { ...x.profile, totalBudget: 25000 } }))

    // A reads, then B writes first, so A's write is stale.
    const seenByA = srv.get()
    sync(b, srv)
    a.absorb(seenByA.doc)
    const first = srv.put(a.doc, seenByA.version)
    expect(first.ok).toBe(false)
    expect(srv.conflicts).toBe(1)
    if (first.ok) return
    a.absorb(first.doc)
    expect(srv.put(a.doc, first.version).ok).toBe(true)
    sync(b, srv)

    expect(a.doc.state.suppliers.map((s) => s.id)).toEqual(['sa'])
    expect(a.doc.state.profile.totalBudget).toBe(25000)
    expect(docsEqual(a.doc, b.doc)).toBe(true)
  })

  it('a delete on one phone while the other edits something else survives the round trip', () => {
    const time = fakeTime()
    const s = base()
    s.suppliers = [sup('s1', 'Barn'), sup('s2', 'Castle')]
    const start: SyncDoc = { state: s, meta: emptyMeta() }
    const srv = server(start)
    const a = device('A', start, time)
    const b = device('B', start, time)
    a.edit((x) => ({ ...x, suppliers: x.suppliers.filter((r) => r.id !== 's1') }))
    time.advance()
    b.edit((x) => ({ ...x, suppliers: x.suppliers.map((r) => (r.id === 's2' ? { ...r, notes: 'call Tue' } : r)) }))
    sync(a, srv)
    sync(b, srv)
    sync(a, srv)
    expect(a.doc.state.suppliers.map((r) => r.id)).toEqual(['s2'])
    expect(b.doc.state.suppliers[0].notes).toBe('call Tue')
    expect(docsEqual(a.doc, b.doc)).toBe(true)
  })
})
