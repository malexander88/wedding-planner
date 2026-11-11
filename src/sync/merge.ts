// Per-record merge for the shared wedding plan.
//
// The app state is unchanged (round-1 shape). Alongside it each device keeps a
// small "meta" ledger with a clock per record and per profile field:
//   * collections of records (suppliers, guests, quotes, …) are keyed by id
//     (or a natural key for the two id-less lists);
//   * `profile` and `taskDone` are merged field by field.
// A clock is { t: milliseconds, d: deviceId }. The newer clock wins per record
// (last-writer-wins); deletes leave a tombstone so they are not resurrected by
// the other phone. Ties are broken deterministically so both phones converge.

import type { AppState } from '../types'

export interface Clock {
  t: number
  d: string
}
export interface Entry extends Clock {
  del?: true
}
export interface SyncMeta {
  records: Record<string, Record<string, Entry>>
  fields: Record<string, Record<string, Clock>>
}
export interface SyncDoc {
  state: AppState
  meta: SyncMeta
}

type AnyRecord = Record<string, unknown>
type CollectionName =
  | 'households'
  | 'guests'
  | 'events'
  | 'suppliers'
  | 'quotes'
  | 'budgetLines'
  | 'payments'
  | 'tasks'
  | 'seatingTables'
  | 'seatingAssignments'
  | 'seatingRules'
  | 'runSheet'
  | 'gifts'
  | 'moodBoard'
  | 'venueDates'

const byId = (r: AnyRecord) => String(r.id)

export const COLLECTIONS: Record<CollectionName, (r: AnyRecord) => string> = {
  households: byId,
  guests: byId,
  events: byId,
  suppliers: byId,
  quotes: byId,
  budgetLines: byId,
  payments: byId,
  tasks: byId,
  seatingTables: byId,
  seatingAssignments: (r) => String(r.guestId),
  seatingRules: byId,
  runSheet: byId,
  gifts: byId,
  moodBoard: byId,
  venueDates: (r) => `${String(r.supplierId)}|${String(r.date)}`,
}

export const FIELD_MAPS = ['profile', 'taskDone'] as const
type FieldMapName = (typeof FIELD_MAPS)[number]

export const ZERO: Clock = { t: 0, d: '' }
export const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000

export function emptyMeta(): SyncMeta {
  return { records: {}, fields: {} }
}

/** Deterministic JSON (sorted keys, undefined dropped) for content comparison. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`
  const obj = value as AnyRecord
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

export function compareClock(a: Clock, b: Clock): number {
  if (a.t !== b.t) return a.t < b.t ? -1 : 1
  if (a.d === b.d) return 0
  return a.d < b.d ? -1 : 1
}

/** Monotonic clock for one device. */
export function makeClock(deviceId: string, now: () => number = Date.now) {
  let last = 0
  return (): Clock => {
    last = Math.max(now(), last + 1)
    return { t: last, d: deviceId }
  }
}

function indexRecords(list: unknown, keyOf: (r: AnyRecord) => string): Map<string, AnyRecord> {
  const map = new Map<string, AnyRecord>()
  if (!Array.isArray(list)) return map
  for (const r of list) {
    if (r && typeof r === 'object') {
      const k = keyOf(r as AnyRecord)
      if (!map.has(k)) map.set(k, r as AnyRecord)
    }
  }
  return map
}

function fieldObject(state: AppState, name: FieldMapName): AnyRecord {
  const v = (state as unknown as AnyRecord)[name]
  return v && typeof v === 'object' ? (v as AnyRecord) : {}
}

/**
 * Record a clock for every record/field that differs between `prev` and `next`.
 * Pure: returns a new meta. `changed` is false when nothing user-visible moved.
 */
export function stampChanges(
  prev: AppState,
  next: AppState,
  meta: SyncMeta,
  tick: () => Clock,
): { meta: SyncMeta; changed: boolean } {
  let changed = false
  let clock: Clock | null = null
  const now = () => (clock ??= tick())
  const records = { ...meta.records }
  const fields = { ...meta.fields }

  for (const [name, keyOf] of Object.entries(COLLECTIONS) as [CollectionName, (r: AnyRecord) => string][]) {
    const a = prev[name] as unknown
    const b = next[name] as unknown
    if (a === b) continue
    const before = indexRecords(a, keyOf)
    const after = indexRecords(b, keyOf)
    let col: Record<string, Entry> | null = null
    const put = (k: string, e: Entry) => {
      col ??= { ...(records[name] ?? {}) }
      col[k] = e
      changed = true
    }
    for (const [k, rec] of after) {
      const old = before.get(k)
      if (!old || (old !== rec && stableStringify(old) !== stableStringify(rec))) put(k, { ...now() })
    }
    for (const k of before.keys()) {
      if (!after.has(k)) put(k, { ...now(), del: true })
    }
    if (col) records[name] = col
  }

  for (const name of FIELD_MAPS) {
    const a = fieldObject(prev, name)
    const b = fieldObject(next, name)
    if (a === b) continue
    let col: Record<string, Clock> | null = null
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[k] === b[k]) continue
      if (stableStringify(a[k]) === stableStringify(b[k])) continue
      col ??= { ...(fields[name] ?? {}) }
      col[k] = { ...now() }
      changed = true
    }
    if (col) fields[name] = col
  }

  return { meta: changed ? { records, fields } : meta, changed }
}

/** Decide one key: returns which side wins. Symmetric so both phones agree. */
function pick(
  lEntry: Entry | undefined,
  lValue: unknown,
  rEntry: Entry | undefined,
  rValue: unknown,
): 'l' | 'r' {
  const lc: Entry | undefined = lEntry ?? (lValue !== undefined ? ZERO : undefined)
  const rc: Entry | undefined = rEntry ?? (rValue !== undefined ? ZERO : undefined)
  if (!rc) return 'l'
  if (!lc) return 'r'
  const c = compareClock(lc, rc)
  if (c !== 0) return c > 0 ? 'l' : 'r'
  // Same clock (or both legacy): prefer a delete, then the larger content.
  if (!!lc.del !== !!rc.del) return lc.del ? 'l' : 'r'
  return stableStringify(lValue) >= stableStringify(rValue) ? 'l' : 'r'
}

function pruneTombstones(col: Record<string, Entry>, horizon: number): Record<string, Entry> {
  const out: Record<string, Entry> = {}
  for (const [k, e] of Object.entries(col)) {
    if (e.del && e.t < horizon) continue
    out[k] = e
  }
  return out
}

/**
 * Merge two documents. Deterministic and symmetric: merge(a, b) and merge(b, a)
 * give the same records; list order follows `remote`, then local-only records.
 */
export function mergeDocs(local: SyncDoc, remote: SyncDoc, now = Date.now()): SyncDoc {
  const horizon = now - TOMBSTONE_TTL_MS
  const state = { ...local.state } as unknown as AnyRecord
  const records: SyncMeta['records'] = {}
  const fields: SyncMeta['fields'] = {}

  for (const [name, keyOf] of Object.entries(COLLECTIONS) as [CollectionName, (r: AnyRecord) => string][]) {
    const lRecs = indexRecords(local.state[name], keyOf)
    const rRecs = indexRecords(remote.state[name], keyOf)
    const lMeta = local.meta.records[name] ?? {}
    const rMeta = remote.meta.records[name] ?? {}
    // Remote (server) order is canonical; records only this phone has go last.
    const order = [...rRecs.keys(), ...lRecs.keys(), ...Object.keys(rMeta), ...Object.keys(lMeta)]
    const seen = new Set<string>()
    const outList: AnyRecord[] = []
    const outMeta: Record<string, Entry> = {}
    for (const k of order) {
      if (seen.has(k)) continue
      seen.add(k)
      const side = pick(lMeta[k], lRecs.get(k), rMeta[k], rRecs.get(k))
      const entry = side === 'l' ? lMeta[k] : rMeta[k]
      const rec = side === 'l' ? lRecs.get(k) : rRecs.get(k)
      if (entry) outMeta[k] = entry
      if (rec && !entry?.del) outList.push(rec)
    }
    state[name] = outList
    const pruned = pruneTombstones(outMeta, horizon)
    if (Object.keys(pruned).length) records[name] = pruned
  }

  for (const name of FIELD_MAPS) {
    const lObj = fieldObject(local.state, name)
    const rObj = fieldObject(remote.state, name)
    const lMeta = local.meta.fields[name] ?? {}
    const rMeta = remote.meta.fields[name] ?? {}
    const out: AnyRecord = {}
    const outMeta: Record<string, Clock> = {}
    const keys = new Set([...Object.keys(lObj), ...Object.keys(rObj), ...Object.keys(lMeta), ...Object.keys(rMeta)])
    for (const k of keys) {
      const side = pick(lMeta[k], lObj[k], rMeta[k], rObj[k])
      const value = side === 'l' ? lObj[k] : rObj[k]
      const clock = side === 'l' ? lMeta[k] : rMeta[k]
      if (value !== undefined) out[k] = value
      if (clock) outMeta[k] = clock
    }
    state[name] = out
    if (Object.keys(outMeta).length) fields[name] = outMeta
  }

  const lu = String(local.state.updatedAt ?? '')
  const ru = String(remote.state.updatedAt ?? '')
  state.updatedAt = lu >= ru ? lu : ru
  state.version = 1

  return { state: state as unknown as AppState, meta: { records, fields } }
}

export function docsEqual(a: SyncDoc, b: SyncDoc): boolean {
  return stableStringify(contentOf(a)) === stableStringify(contentOf(b))
}

/** Compare everything except the cosmetic top-level updatedAt. */
function contentOf(doc: SyncDoc) {
  const { updatedAt: _u, ...rest } = doc.state
  void _u
  return { state: rest, meta: doc.meta }
}

// ---- wire format ----------------------------------------------------------

export const WIRE_SCHEMA = 'wp-sync-1'

export interface WireDoc {
  schema: typeof WIRE_SCHEMA
  state: AppState
  meta: SyncMeta
}

export function toWire(doc: SyncDoc): WireDoc {
  return { schema: WIRE_SCHEMA, state: doc.state, meta: doc.meta }
}

export function fromWire(value: unknown): SyncDoc | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<WireDoc>
  if (v.schema !== WIRE_SCHEMA || !v.state || typeof v.state !== 'object') return null
  if ((v.state as AppState).version !== 1 || !(v.state as AppState).profile) return null
  const meta = v.meta && typeof v.meta === 'object' ? v.meta : emptyMeta()
  return {
    state: v.state as AppState,
    meta: { records: meta.records ?? {}, fields: meta.fields ?? {} },
  }
}
