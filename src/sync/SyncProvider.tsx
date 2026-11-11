import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { isSyncConfigured } from '../config/supabase'
import { useStore } from '../state/store'
import { needsBudgetCleanup } from '../data/budget'
import { isBlankPlan } from '../data/blank'
import { getItem, removeItem, setItem, setItemNow } from '../storage/indexeddb'
import type { AppState } from '../types'
import { syncApi } from './api'
import {
  docsEqual,
  emptyMeta,
  fromWire,
  makeClock,
  isErasedDoc,
  mergeDocs,
  pushWouldWipe,
  stampChanges,
  toWire,
  type Clock,
  type SyncDoc,
  type SyncMeta,
} from './merge'
import { buildJoinLink, generateSecret, isValidSecret, parseJoin, takePendingJoin } from './secret'

const META_KEY = 'syncMeta'
const LINK_KEY = 'syncLink'
const DEVICE_KEY = 'deviceId'
const PUSH_DELAY_MS = 1500
const POLL_MS = 15000

export type SyncStatus =
  | 'off' // not configured in this build
  | 'unpaired'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'
  | 'revoked' // the link was replaced on the other phone

interface SyncLink {
  secret: string
  version: number
  lastSyncedAt?: string
}

export interface PendingJoin {
  secret: string
  /** Remote state found for the link; null while checking. */
  remote: SyncDoc | null
  version: number
  error?: string
}

interface SyncCtx {
  configured: boolean
  status: SyncStatus
  paired: boolean
  link: string | null
  lastSyncedAt: string | null
  error: string | null
  joining: boolean
  pendingJoin: PendingJoin | null
  startSharing: () => Promise<void>
  syncNow: () => Promise<void>
  rotateLink: () => Promise<void>
  stopSharing: () => Promise<void>
  joinWith: (input: string) => Promise<boolean>
  confirmJoin: () => Promise<void>
  cancelJoin: () => void
}

const Ctx = createContext<SyncCtx | null>(null)

function hasOwnPlan(s: AppState): boolean {
  return s.profile.onboardingComplete
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { state, loadStatus, dispatch, wipeIntent } = useStore()
  // Only a successfully loaded plan may be synced: never sync a placeholder.
  const ready = loadStatus === 'ok'
  const configured = isSyncConfigured()

  const [loaded, setLoaded] = useState(false)
  const [linkInfo, setLinkInfo] = useState<SyncLink | null>(null)
  const [status, setStatus] = useState<SyncStatus>(configured ? 'unpaired' : 'off')
  const [error, setError] = useState<string | null>(null)
  const [pendingJoin, setPendingJoin] = useState<PendingJoin | null>(null)
  const [joining, setJoining] = useState(false)

  const metaRef = useRef<SyncMeta>(emptyMeta())
  const baseRef = useRef<AppState>(state)
  const linkRef = useRef<SyncLink | null>(null)
  const tickRef = useRef<() => Clock>(makeClock('pending'))
  const dirtyRef = useRef(false)
  const inFlight = useRef(false)
  const rerun = useRef(false)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveLink = useCallback(async (next: SyncLink | null) => {
    linkRef.current = next
    setLinkInfo(next)
    if (next) await setItem(LINK_KEY, next)
    else await removeItem(LINK_KEY)
  }, [])

  const persistMeta = useCallback(() => {
    if (metaTimer.current) clearTimeout(metaTimer.current)
    metaTimer.current = setTimeout(() => {
      metaTimer.current = null
      setItem(META_KEY, metaRef.current).catch(() => undefined)
    }, 300)
  }, [])

  /** Replace local state+meta with a doc without stamping it as a local edit. */
  const applyDoc = useCallback(
    (doc: SyncDoc) => {
      // A blank result is only acceptable when it records an explicit erase.
      if (isBlankPlan(doc.state) && !isBlankPlan(baseRef.current)) {
        if (!isErasedDoc(doc)) {
          console.warn('[wedding-planner] ignored an empty shared plan')
          return
        }
        wipeIntent.current = Date.now()
      }
      metaRef.current = doc.meta
      baseRef.current = doc.state
      persistMeta()
      dispatch({ type: 'hydrate', state: doc.state })
    },
    [dispatch, persistMeta, wipeIntent],
  )

  const localDoc = (): SyncDoc => ({ state: baseRef.current, meta: metaRef.current })

  // ---- load sync bookkeeping once the plan itself has loaded ------------
  useEffect(() => {
    if (!ready || loaded) return
    let cancelled = false
    ;(async () => {
      let deviceId = await getItem<string>(DEVICE_KEY).catch(() => null)
      if (!deviceId) {
        deviceId = generateSecret(9)
        await setItem(DEVICE_KEY, deviceId).catch(() => undefined)
      }
      const meta = (await getItem<SyncMeta>(META_KEY).catch(() => null)) ?? emptyMeta()
      const link = await getItem<SyncLink>(LINK_KEY).catch(() => null)
      if (cancelled) return
      tickRef.current = makeClock(deviceId)
      metaRef.current = { records: meta.records ?? {}, fields: meta.fields ?? {} }
      baseRef.current = state
      if (link && isValidSecret(link.secret)) {
        linkRef.current = link
        setLinkInfo(link)
        if (configured) setStatus('synced')
      }
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, loaded])

  // ---- core sync cycle -------------------------------------------------
  const syncNow = useCallback(async () => {
    const link = linkRef.current
    if (!configured || !link || !loaded) return
    if (inFlight.current) {
      rerun.current = true
      return
    }
    inFlight.current = true
    setStatus('syncing')
    try {
      let remote = await syncApi.getState(link.secret)
      for (let attempt = 0; attempt < 4; attempt++) {
        if (!remote.found) {
          setStatus('revoked')
          setError('This sharing link was replaced on the other phone. Ask for the new link to keep sharing.')
          return
        }
        const snapshot = localDoc()
        const remoteDoc = fromWire(remote.state)
        const merged = remoteDoc ? mergeDocs(snapshot, remoteDoc) : snapshot
        const needPush = !remoteDoc || !docsEqual(merged, remoteDoc)
        let version = remote.version ?? link.version
        if (needPush && pushWouldWipe(remoteDoc, merged, wipeIntent.current > 0)) {
          setStatus('error')
          setError('Didn’t send: this would have emptied your shared plan. Nothing was changed on the other phone.')
          return
        }
        if (needPush) {
          const res = await syncApi.putState(link.secret, toWire(merged), version)
          if (!res.ok) {
            if (res.conflict) {
              remote = res
              continue
            }
            remote = res
            continue
          }
          version = res.version ?? version + 1
        }
        // Fold in anything typed while we were talking to the server.
        const latest = localDoc()
        const final = latest.state === snapshot.state ? merged : mergeDocs(latest, merged)
        if (!docsEqual(final, latest)) applyDoc(final)
        if (latest.state === snapshot.state) dirtyRef.current = false
        await saveLink({ ...link, version, lastSyncedAt: new Date().toISOString() })
        setError(null)
        setStatus('synced')
        return
      }
      setStatus('error')
      setError('The other phone kept saving at the same moment. Trying again shortly.')
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      setStatus(offline ? 'offline' : 'error')
      setError(offline ? null : e instanceof Error ? e.message : 'Could not reach the sync service.')
    } finally {
      inFlight.current = false
      if (rerun.current) {
        rerun.current = false
        setTimeout(() => void syncNow(), 50)
      } else if (dirtyRef.current && linkRef.current) {
        if (pushTimer.current) clearTimeout(pushTimer.current)
        pushTimer.current = setTimeout(() => void syncNow(), PUSH_DELAY_MS)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, loaded, applyDoc, saveLink])

  const syncRef = useRef(syncNow)
  syncRef.current = syncNow

  // ---- one-off cleanup of old pre-filled budget estimates ----------------
  // Runs as a normal edit once sync bookkeeping is loaded, so the removal is
  // stamped (tombstones) and the other phone won't bring the lines back.
  useEffect(() => {
    if (loaded && needsBudgetCleanup(state)) dispatch({ type: 'pruneStarterLines' })
  }, [loaded, state, dispatch])

  // ---- flush bookkeeping when the app is hidden or closed ------------------
  useEffect(() => {
    const flush = () => {
      if (!metaTimer.current) return
      clearTimeout(metaTimer.current)
      metaTimer.current = null
      if (!setItemNow(META_KEY, metaRef.current)) setItem(META_KEY, metaRef.current).catch(() => undefined)
    }
    const onVis = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // ---- stamp local edits, then push (debounced) --------------------------
  useEffect(() => {
    if (!loaded) return
    if (state === baseRef.current) return
    if (isBlankPlan(state) && !isBlankPlan(baseRef.current) && !wipeIntent.current) {
      // Never record "everything deleted" unless the couple pressed Erase.
      console.warn('[wedding-planner] refused to record an empty plan over a real one; restoring it')
      dispatch({ type: 'hydrate', state: baseRef.current })
      return
    }
    const { meta, changed } = stampChanges(baseRef.current, state, metaRef.current, tickRef.current)
    baseRef.current = state
    if (!changed) return
    metaRef.current = meta
    persistMeta()
    dirtyRef.current = true
    if (linkRef.current && configured) {
      if (pushTimer.current) clearTimeout(pushTimer.current)
      pushTimer.current = setTimeout(() => void syncRef.current(), PUSH_DELAY_MS)
    }
  }, [state, loaded, configured, persistMeta])

  // ---- pull on open, focus, reconnect and every 15s while visible ------
  useEffect(() => {
    if (!loaded || !configured || !linkInfo) return
    const run = () => {
      if (document.visibilityState === 'visible') void syncRef.current()
    }
    run()
    const iv = setInterval(run, POLL_MS)
    window.addEventListener('focus', run)
    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', run)
    return () => {
      clearInterval(iv)
      window.removeEventListener('focus', run)
      window.removeEventListener('online', run)
      document.removeEventListener('visibilitychange', run)
    }
    // Re-arm only when pairing changes, not on every version bump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, configured, linkInfo?.secret])

  // ---- joining from a link ----------------------------------------------
  const beginJoin = useCallback(
    async (secret: string): Promise<boolean> => {
      if (!configured) {
        setPendingJoin({ secret, remote: null, version: 0, error: 'Sharing is not switched on in this version of the app yet.' })
        return false
      }
      if (linkRef.current?.secret === secret) {
        void syncRef.current()
        return true
      }
      setJoining(true)
      try {
        const res = await syncApi.getState(secret)
        const remote = res.found ? fromWire(res.state) : null
        if (!res.found || !remote) {
          setPendingJoin({
            secret,
            remote: null,
            version: 0,
            error: res.found
              ? 'That shared plan looks empty or damaged.'
              : 'That link no longer works. It may have been replaced — ask for the newest link.',
          })
          return false
        }
        const version = res.version ?? 1
        if (!hasOwnPlan(baseRef.current) && !linkRef.current) {
          // Fresh phone: just adopt the shared plan.
          applyDoc(remote)
          dirtyRef.current = false
          await saveLink({ secret, version, lastSyncedAt: new Date().toISOString() })
          setStatus('synced')
          setError(null)
          return true
        }
        if (linkRef.current) {
          // Already sharing (e.g. the link was replaced): same household, so merge
          // rather than replace, keeping anything typed on this phone meanwhile.
          applyDoc(mergeDocs(localDoc(), remote))
          dirtyRef.current = true
          await saveLink({ secret, version, lastSyncedAt: new Date().toISOString() })
          setError(null)
          setStatus('synced')
          void syncRef.current()
          return true
        }
        setPendingJoin({ secret, remote, version })
        return false
      } catch (e) {
        setPendingJoin({
          secret,
          remote: null,
          version: 0,
          error: navigator.onLine
            ? `Could not open the shared plan (${e instanceof Error ? e.message : 'unknown error'}).`
            : 'You are offline. Open the link again when you have signal.',
        })
        return false
      } finally {
        setJoining(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configured, applyDoc, saveLink],
  )

  useEffect(() => {
    if (!loaded) return
    const fromStart = takePendingJoin()
    if (fromStart) void beginJoin(fromStart)
    const onHash = () => {
      const s = parseJoin(window.location.hash)
      if (!s) return
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
      void beginJoin(s)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [loaded, beginJoin])

  const confirmJoin = useCallback(async () => {
    const pj = pendingJoin
    if (!pj?.remote) return
    // Keep a copy of this phone's own plan before replacing it.
    await setItem('preJoinBackup', { savedAt: new Date().toISOString(), state: baseRef.current }).catch(() => undefined)
    applyDoc(pj.remote)
    dirtyRef.current = false
    await saveLink({ secret: pj.secret, version: pj.version, lastSyncedAt: new Date().toISOString() })
    setPendingJoin(null)
    setStatus('synced')
    setError(null)
  }, [pendingJoin, applyDoc, saveLink])

  const cancelJoin = useCallback(() => setPendingJoin(null), [])

  const joinWith = useCallback(
    async (input: string) => {
      const secret = parseJoin(input)
      if (!secret) {
        setError('That does not look like a sharing link.')
        return false
      }
      return beginJoin(secret)
    },
    [beginJoin],
  )

  // ---- create / rotate / stop ------------------------------------------
  const startSharing = useCallback(async () => {
    if (!configured || linkRef.current) return
    setStatus('syncing')
    try {
      if (isBlankPlan(baseRef.current)) throw new Error('Set up your plan first, then share it.')
      const secret = generateSecret()
      const res = await syncApi.createHousehold(secret, toWire(localDoc()))
      await saveLink({ secret, version: res.version ?? 1, lastSyncedAt: new Date().toISOString() })
      dirtyRef.current = false
      setError(null)
      setStatus('synced')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Could not start sharing.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, saveLink])

  const rotateLink = useCallback(async () => {
    const link = linkRef.current
    if (!configured || !link) return
    setStatus('syncing')
    try {
      const next = generateSecret()
      const res = await syncApi.rotateSecret(link.secret, next)
      if (!res.found) {
        setStatus('revoked')
        setError('This link had already been replaced on the other phone.')
        return
      }
      await saveLink({ ...link, secret: next })
      setError(null)
      setStatus('synced')
      void syncRef.current()
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Could not make a new link.')
    }
  }, [configured, saveLink])

  const stopSharing = useCallback(async () => {
    if (pushTimer.current) clearTimeout(pushTimer.current)
    await saveLink(null)
    setError(null)
    setStatus(configured ? 'unpaired' : 'off')
  }, [configured, saveLink])

  const link = linkInfo
    ? buildJoinLink(linkInfo.secret, window.location.origin, import.meta.env.BASE_URL)
    : null

  const value = useMemo<SyncCtx>(
    () => ({
      configured,
      status: configured ? (linkInfo ? status : 'unpaired') : 'off',
      paired: !!linkInfo,
      link,
      lastSyncedAt: linkInfo?.lastSyncedAt ?? null,
      error,
      joining,
      pendingJoin,
      startSharing,
      syncNow,
      rotateLink,
      stopSharing,
      joinWith,
      confirmJoin,
      cancelJoin,
    }),
    [configured, linkInfo, status, link, error, joining, pendingJoin, startSharing, syncNow, rotateLink, stopSharing, joinWith, confirmJoin, cancelJoin],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSync() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSync outside SyncProvider')
  return ctx
}
