// The partner-activity feed, kept on this phone only (IndexedDB 'kv' store, key 'activity').
import { useCallback, useEffect, useState } from 'react'
import { getItem, removeItem, setItem } from '../storage/indexeddb'
import { addToLog, SEEN_KEY, unseenCount, type ActivityItem } from './activity'

export const ACTIVITY_KEY = 'activity'
const EVENT = 'wp-activity'

let chain: Promise<unknown> = Promise.resolve()

/** Append fresh lines (serialised so two quick syncs can't overwrite each other). */
export function recordActivity(fresh: ActivityItem[]): Promise<void> {
  if (!fresh.length) return Promise.resolve()
  const run = chain.then(async () => {
    const log = (await getItem<ActivityItem[]>(ACTIVITY_KEY).catch(() => null)) ?? []
    await setItem(ACTIVITY_KEY, addToLog(log, fresh))
    window.dispatchEvent(new Event(EVENT))
  })
  chain = run.catch(() => undefined)
  return run
}

export async function clearActivity(): Promise<void> {
  await removeItem(ACTIVITY_KEY).catch(() => undefined)
  window.dispatchEvent(new Event(EVENT))
}

export function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

export function markActivitySeen(at = Date.now()) {
  try {
    localStorage.setItem(SEEN_KEY, String(at))
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useActivity(): { log: ActivityItem[]; seenAt: number; unseen: number; loaded: boolean } {
  const [log, setLog] = useState<ActivityItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [seenAt, setSeenAt] = useState(readSeen)
  const load = useCallback(() => {
    getItem<ActivityItem[]>(ACTIVITY_KEY)
      .catch(() => null)
      .then((l) => {
        setLog(l ?? [])
        setSeenAt(readSeen())
        setLoaded(true)
      })
  }, [])
  useEffect(() => {
    load()
    window.addEventListener(EVENT, load)
    return () => window.removeEventListener(EVENT, load)
  }, [load])
  return { log, seenAt, unseen: unseenCount(log, seenAt), loaded }
}
