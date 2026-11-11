import type { AppState, StorageAdapter } from '../types'

const DB = 'wedding-planner'
const STORE = 'kv'
const KEY = 'state'

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
  })
  return opening
}

/** Start writing the plan right now (used on pagehide). Returns false if the DB isn't open yet. */
export function saveStateNow(state: AppState): boolean {
  if (!opened) return false
  try {
    const tx = opened.transaction(STORE, 'readwrite', { durability: 'strict' })
    tx.objectStore(STORE).put(state, KEY)
    tx.commit?.() // ask the browser to commit now, before the page goes away
    return true
  } catch {
    return false
  }
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

export const indexedDbStorage: StorageAdapter = {
  async getState() {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve((req.result as AppState) ?? null)
      req.onerror = () => reject(req.error)
    })
  },
  async setState(state) {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(state, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },
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

export async function removeItem(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
