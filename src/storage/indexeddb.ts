import { isBlankPlan } from '../data/blank'
import type { AppState, StorageAdapter } from '../types'

const DB = 'wedding-planner'
const STORE = 'kv'
const KEY = 'state'
const BACKUPS = 'backups'
export const MAX_BACKUPS = 5
const BACKUP_GAP_MS = 10 * 60 * 1000

export class WipeRefusedError extends Error {
  constructor() {
    super('Refused to replace a saved plan with an empty one')
    this.name = 'WipeRefusedError'
  }
}

// One shared connection, kept open so a save can start synchronously while the
// page is being hidden or closed (an async open would never finish then).
let opened: IDBDatabase | null = null
let opening: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (opened) return Promise.resolve(opened)
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => {
        db.close()
        opened = null
        opening = null
      }
      db.onclose = () => {
        opened = null
        opening = null
      }
      opened = db
      resolve(db)
    }
    req.onerror = () => {
      opening = null
      reject(req.error)
    }
    req.onblocked = () => {
      opening = null
      reject(new Error('Saved plan is locked by another window'))
    }
  })
  return opening
}

/** For tests: drop the cached connection. */
export function _resetConnection() {
  opened?.close()
  opened = null
  opening = null
}

/**
 * Write the plan, refusing (inside the same transaction, so nothing can slip in
 * between) to replace a non-blank saved plan with a blank one unless allowWipe.
 */
function guardedPut(db: IDBDatabase, state: AppState, allowWipe: boolean, onRefuse?: () => void): IDBTransaction {
  const tx = db.transaction(STORE, 'readwrite', { durability: 'strict' })
  const store = tx.objectStore(STORE)
  if (!allowWipe && isBlankPlan(state)) {
    const cur = store.get(KEY)
    cur.onsuccess = () => {
      if (cur.result && !isBlankPlan(cur.result as AppState)) {
        console.warn('[wedding-planner] refused to overwrite your saved plan with an empty one')
        onRefuse?.()
        tx.abort()
      } else {
        store.put(state, KEY)
      }
    }
  } else {
    store.put(state, KEY)
  }
  return tx
}

/** Start writing the plan right now (used on pagehide). Returns false if the DB isn't open yet. */
export function saveStateNow(state: AppState, allowWipe = false): boolean {
  if (!opened) return false
  try {
    const tx = guardedPut(opened, state, allowWipe)
    tx.commit?.() // ask the browser to commit now, before the page goes away
    return true
  } catch {
    return false
  }
}

export interface SaveOptions {
  allowWipe?: boolean
}

export const indexedDbStorage: StorageAdapter & {
  setState(state: AppState, opts?: SaveOptions): Promise<void>
} = {
  async getState() {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve((req.result as AppState) ?? null)
      req.onerror = () => reject(req.error)
    })
  },
  async setState(state, opts: SaveOptions = {}) {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      let refused = false
      const tx = guardedPut(db, state, !!opts.allowWipe, () => (refused = true))
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(refused ? new WipeRefusedError() : tx.error)
      tx.onerror = () => reject(refused ? new WipeRefusedError() : tx.error)
    })
  },
}

// ---- rolling backups of real (non-blank) plans ------------------------------

export interface Backup {
  savedAt: string
  state: AppState
}

export async function getBackups(): Promise<Backup[]> {
  const list = await getItem<Backup[]>(BACKUPS)
  return Array.isArray(list) ? list : []
}

/**
 * Keep the last few real plans. A new snapshot is taken at most every 10
 * minutes (or straight away when forced, e.g. before a restore or erase).
 */
export async function backupState(state: AppState, opts: { force?: boolean; now?: number } = {}): Promise<boolean> {
  if (isBlankPlan(state)) return false
  const now = opts.now ?? Date.now()
  const list = await getBackups()
  const last = list[0]
  if (!opts.force && last && now - Date.parse(last.savedAt) < BACKUP_GAP_MS) return false
  if (last && last.state.updatedAt === state.updatedAt && JSON.stringify(last.state) === JSON.stringify(state)) return false
  const next = [{ savedAt: new Date(now).toISOString(), state }, ...list].slice(0, MAX_BACKUPS)
  await setItem(BACKUPS, next)
  return true
}

// Extra keys in the same object store (no schema/version change needed).
export async function getItem<T>(key: string): Promise<T | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as T) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Same for the extra keys. */
export function setItemNow<T>(key: string, value: T): boolean {
  if (!opened) return false
  try {
    const tx = opened.transaction(STORE, 'readwrite', { durability: 'strict' })
    tx.objectStore(STORE).put(value, key)
    tx.commit?.()
    return true
  } catch {
    return false
  }
}

export async function removeItem(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
