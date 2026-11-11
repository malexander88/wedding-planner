import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { pruneStarterLines } from '../data/budget'
import { activeTasks, EDIT_FIELDS, generatedSpecs, isTaskDone, mergeTasks, overrideId, type TaskEdits } from '../data/checklist'
import { stableStringify } from '../sync/merge'
import { applyTaskDetail } from '../data/taskDetails'
import { uid } from '../lib/ids'
import { backupState, indexedDbStorage, saveStateNow } from '../storage/indexeddb'
import { isBlankPlan } from '../data/blank'
import type {
  AppState,
  BudgetLine,
  Guest,
  Household,
  Payment,
  Quote,
  Supplier,
  SupplierCategory,
  SupplierStatus,
  Assignee,
  PlanTask,
  Task,
  TaskDetail,
  TemplateId,
  WeddingProfile,
} from '../types'

const DEFAULT_PROFILE: WeddingProfile = {
  partnerAName: '',
  partnerBName: '',
  area: 'Belfast, Antrim & Newtownabbey',
  style: 'classic',
  season: 'any',
  estimatedDayGuests: 80,
  estimatedEveningGuests: 40,
  totalBudget: 0,
  bufferPercent: 12,
  ceremonyType: 'undecided',
  previouslyMarried: false,
  candidateDates: [],
  onboardingComplete: false,
}

export function emptyState(): AppState {
  return {
    version: 1,
    profile: { ...DEFAULT_PROFILE },
    households: [],
    guests: [],
    events: [
      { id: 'ev_ceremony', kind: 'ceremony', name: 'Ceremony' },
      { id: 'ev_breakfast', kind: 'breakfast', name: 'Wedding breakfast' },
      { id: 'ev_evening', kind: 'evening', name: 'Evening' },
    ],
    suppliers: [],
    quotes: [],
    budgetLines: [],
    payments: [],
    tasks: [],
    taskDone: {},
    seatingTables: [],
    seatingAssignments: [],
    seatingRules: [],
    runSheet: [],
    gifts: [],
    moodBoard: [],
    venueDates: [],
    taskDetails: [],
    updatedAt: new Date().toISOString(),
  }
}

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'patchProfile'; patch: Partial<WeddingProfile> }
  | { type: 'completeOnboarding'; profile: WeddingProfile }
  | { type: 'setDate'; date?: string }
  | { type: 'addCandidate'; date: string }
  | { type: 'removeCandidate'; date: string }
  | { type: 'setAvailability'; supplierId: string; date: string; availability: AppState['venueDates'][0]['availability'] }
  | { type: 'toggleTask'; key: string }
  | { type: 'setTaskDone'; key: string; done: boolean }
  | { type: 'addCustomTask'; title: string; stage: string; template?: TemplateId; dueDate?: string; assignee?: Assignee; key?: string }
  | { type: 'editTask'; key: string; patch: TaskEdits }
  /** Custom tasks are removed (tombstoned); built-in ones are marked removed so they can come back. */
  | { type: 'removeTask'; key: string }
  /** Undo of removeTask for a custom task: put the record back as it was. */
  | { type: 'restoreTask'; task: Task }
  | { type: 'saveTaskDetail'; detail: TaskDetail; markDone?: boolean }
  | { type: 'removeTaskDetail'; taskKey: string }
  | { type: 'addSupplier'; supplier: Supplier }
  | { type: 'updateSupplier'; id: string; patch: Partial<Supplier> }
  | { type: 'setSupplierStatus'; id: string; status: SupplierStatus }
  | { type: 'removeSupplier'; id: string }
  | { type: 'addQuote'; quote: Quote }
  | { type: 'updateQuote'; id: string; patch: Partial<Quote> }
  | { type: 'removeQuote'; id: string }
  | {
      type: 'bookSupplier'
      supplierId: string
      quoteId?: string
      deposit: number
      depositDue: string
      balanceDue: string
    }
  | { type: 'upsertBudgetLine'; line: BudgetLine }
  | { type: 'removeBudgetLine'; id: string }
  | { type: 'addPayment'; payment: Payment }
  | { type: 'updatePayment'; id: string; patch: Partial<Payment> }
  | { type: 'removePayment'; id: string }
  | { type: 'addHousehold'; household: Household }
  | { type: 'updateHousehold'; id: string; patch: Partial<Household> }
  | { type: 'removeHousehold'; id: string }
  | { type: 'addGuest'; guest: Guest }
  | { type: 'updateGuest'; id: string; patch: Partial<Guest> }
  | { type: 'removeGuest'; id: string }
  | { type: 'restoreGuests'; household?: Household; householdIndex?: number; guests: Guest[]; guestIndex?: number }
  | { type: 'importState'; state: AppState }
  | { type: 'reset' }
  /** Explicit 'erase everything' from Settings: the only way a blank plan may replace a real one. */
  | { type: 'eraseAll' }
  | { type: 'pruneStarterLines' }

function touch(state: AppState): AppState {
  return { ...state, updatedAt: new Date().toISOString() }
}

/** Moving the wedding date restarts the "catch up" clock, so a new date doesn't flood the plan with overdue items. */
export function reducer(state: AppState, action: Action): AppState {
  const next = baseReducer(state, action)
  const after = next.profile.date
  // Only the couple's own date changes — never hydrate or sync, so loading never writes.
  const own = action.type === 'patchProfile' || action.type === 'setDate' || action.type === 'completeOnboarding'
  if (own && next !== state && after && after !== state.profile.date) {
    return { ...next, profile: { ...next.profile, datesFrom: localToday() } }
  }
  return next
}

function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Apply a task edit; null when nothing would change (so nothing is written or synced). */
function applyTaskEdit(state: AppState, key: string, patch: TaskEdits): AppState | null {
  const idx = state.tasks.findIndex((t) => t.key === key)
  const cur = idx >= 0 ? state.tasks[idx] : undefined
  const builtIn = generatedSpecs(state.profile).find((s) => s.key === key)
  if (!cur && !builtIn) return null
  const custom = !builtIn
  const rec: Task = cur
    ? { ...cur }
    : { id: overrideId(key), key, title: '', body: '', stage: '', dueDate: '', officialUrl: '', officialLabel: '', legal: false, custom: false, done: false }
  const p: Record<string, unknown> = { ...patch }
  if (!custom) {
    // Built-in: title and date edits are overrides; stage and kind come from the catalogue.
    if ('title' in p) {
      const t = String(p.title ?? '').trim()
      p.titleOverride = t && t !== builtIn.title ? t : undefined
      delete p.title
    }
    delete p.stage
    delete p.template
    if ('dueOverride' in p && p.dueOverride === builtIn.dueDate) p.dueOverride = undefined
  } else {
    if ('title' in p) {
      const t = String(p.title ?? '').trim()
      if (t) p.title = t
      else delete p.title
    }
    // A custom task's date is simply its date.
    if ('dueOverride' in p) {
      p.dueDate = (p.dueOverride as string | undefined) ?? ''
      delete p.dueOverride
    }
  }
  const out = { ...rec, ...p } as Record<string, unknown>
  // Keep records small: drop cleared edits rather than storing blanks.
  for (const f of EDIT_FIELDS) if (out[f] === undefined || out[f] === '' || out[f] === false) delete out[f]
  if (cur && stableStringify(out) === stableStringify(cur)) return null
  if (!cur && EDIT_FIELDS.every((f) => out[f] === undefined)) return null
  const tasks = [...state.tasks]
  if (idx >= 0) tasks[idx] = out as unknown as Task
  else tasks.push(out as unknown as Task)
  return { ...state, tasks }
}

function baseReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
    case 'importState':
      return { ...emptyState(), ...action.state, version: 1 }
    case 'reset':
    case 'eraseAll':
      return emptyState()
    case 'pruneStarterLines': {
      // Old versions pre-filled estimate lines; drop the untouched ones as a
      // normal edit so sync records tombstones and the other phone agrees.
      const next = pruneStarterLines(state)
      return next === state ? state : touch(next)
    }
    case 'patchProfile': {
      const next = touch({ ...state, profile: { ...state.profile, ...action.patch } })
      // Setting a total budget for the first time ticks 'Agree your total budget'.
      if ((action.patch.totalBudget ?? 0) > 0 && !(state.profile.totalBudget > 0) && state.taskDone['vision-budget'] === undefined)
        next.taskDone = { ...next.taskDone, 'vision-budget': true }
      return next
    }
    case 'completeOnboarding': {
      const profile = { ...action.profile, onboardingComplete: true }
      // The answers already cover the first two Plan tasks.
      const taskDone = { ...state.taskDone }
      if (profile.totalBudget > 0) taskDone['vision-budget'] = true
      if (profile.estimatedDayGuests > 0) taskDone['vision-guests'] = true
      return touch({
        ...state,
        profile,
        taskDone,
      })
    }
    case 'setDate':
      return touch({
        ...state,
        profile: { ...state.profile, date: action.date },
        // Choosing a date is the outcome of comparing them.
        taskDone: action.date ? { ...state.taskDone, 'date-compare': true } : state.taskDone,
      })
    case 'addCandidate': {
      if (state.profile.candidateDates.includes(action.date)) return state
      return touch({
        ...state,
        profile: {
          ...state.profile,
          candidateDates: [...state.profile.candidateDates, action.date].sort(),
        },
      })
    }
    case 'removeCandidate':
      return touch({
        ...state,
        profile: {
          ...state.profile,
          candidateDates: state.profile.candidateDates.filter((d) => d !== action.date),
          date: state.profile.date === action.date ? undefined : state.profile.date,
        },
      })
    case 'setAvailability': {
      const rest = state.venueDates.filter(
        (v) => !(v.supplierId === action.supplierId && v.date === action.date),
      )
      return touch({
        ...state,
        venueDates: [...rest, { supplierId: action.supplierId, date: action.date, availability: action.availability }],
      })
    }
    case 'toggleTask':
      return touch({
        ...state,
        taskDone: { ...state.taskDone, [action.key]: !isTaskDone(state, action.key) },
      })
    case 'setTaskDone':
      // Compare with the explicit value: unticking a task the data ticked must still be recorded.
      if (state.taskDone[action.key] === action.done) return state
      if (state.taskDone[action.key] === undefined && isTaskDone(state, action.key) === action.done && !action.done) return state
      return touch({ ...state, taskDone: { ...state.taskDone, [action.key]: action.done } })
    case 'saveTaskDetail': {
      const next = applyTaskDetail(state, action.detail)
      return touch(
        action.markDone ? { ...next, taskDone: { ...next.taskDone, [action.detail.taskKey]: true } } : next,
      )
    }
    case 'removeTaskDetail':
      // Budget lines and payments it created stay; they're real money and live in Budget now.
      return touch({ ...state, taskDetails: state.taskDetails.filter((d) => d.taskKey !== action.taskKey) })
    case 'addCustomTask': {
      const key = action.key ?? `custom_${uid('t')}`
      if (!action.title.trim() || state.tasks.some((t) => t.key === key)) return state
      const task: Task = {
        id: key,
        key,
        title: action.title.trim(),
        body: '',
        stage: action.stage,
        dueDate: action.dueDate ?? '',
        officialUrl: '',
        officialLabel: '',
        legal: false,
        custom: true,
        done: false,
        template: action.template ?? 'generic',
        ...(action.assignee ? { assignee: action.assignee } : {}),
      }
      return touch({ ...state, tasks: [...state.tasks, task] })
    }
    case 'editTask': {
      const next = applyTaskEdit(state, action.key, action.patch)
      return next ? touch(next) : state
    }
    case 'removeTask': {
      const builtIn = generatedSpecs(state.profile).some((s) => s.key === action.key)
      if (!builtIn) {
        if (!state.tasks.some((t) => t.key === action.key)) return state
        return touch({ ...state, tasks: state.tasks.filter((t) => t.key !== action.key) })
      }
      const next = applyTaskEdit(state, action.key, { removed: true })
      return next ? touch(next) : state
    }
    case 'restoreTask': {
      if (state.tasks.some((t) => t.key === action.task.key)) return state
      return touch({ ...state, tasks: [...state.tasks, action.task] })
    }
    case 'addSupplier':
      if (action.supplier.catalogueId && state.suppliers.some((s) => s.catalogueId === action.supplier.catalogueId)) {
        return state
      }
      return touch({ ...state, suppliers: [...state.suppliers, action.supplier] })
    case 'updateSupplier':
      return touch({
        ...state,
        suppliers: state.suppliers.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      })
    case 'setSupplierStatus':
      return touch({
        ...state,
        suppliers: state.suppliers.map((s) => (s.id === action.id ? { ...s, status: action.status } : s)),
      })
    case 'removeSupplier':
      return touch({
        ...state,
        suppliers: state.suppliers.filter((s) => s.id !== action.id),
        quotes: state.quotes.filter((q) => q.supplierId !== action.id),
      })
    case 'addQuote':
      return touch({
        ...state,
        quotes: [...state.quotes, action.quote],
        suppliers: state.suppliers.map((s) =>
          s.id === action.quote.supplierId && (s.status === 'shortlisted' || s.status === 'enquired')
            ? { ...s, status: 'quoted' }
            : s,
        ),
      })
    case 'updateQuote':
      return touch({
        ...state,
        quotes: state.quotes.map((q) => (q.id === action.id ? { ...q, ...action.patch } : q)),
      })
    case 'removeQuote':
      return touch({ ...state, quotes: state.quotes.filter((q) => q.id !== action.id) })
    case 'bookSupplier': {
      const supplier = state.suppliers.find((s) => s.id === action.supplierId)
      if (!supplier) return state
      const quote = action.quoteId
        ? state.quotes.find((q) => q.id === action.quoteId)
        : [...state.quotes].reverse().find((q) => q.supplierId === action.supplierId)
      const amount = quote?.amount ?? 0
      let lines = [...state.budgetLines]
      let line = lines.find((l) => l.supplierId === supplier.id)
      if (!line) {
        line = {
          id: uid('bl'),
          category: supplier.category,
          name: supplier.name,
          estimate: amount,
          quoted: amount,
          actual: 0,
          vatIncluded: quote?.vatIncluded ?? true,
          supplierId: supplier.id,
          notes: quote?.inclusions ?? '',
        }
        lines = [...lines, line]
      } else {
        lines = lines.map((l) =>
          l.id === line!.id ? { ...l, quoted: amount || l.quoted, name: supplier.name } : l,
        )
      }
      const payments = [...state.payments]
      if (action.deposit > 0) {
        payments.push({
          id: uid('pay'),
          budgetLineId: line.id,
          supplierId: supplier.id,
          kind: 'deposit',
          amount: action.deposit,
          dueDate: action.depositDue,
          paidDate: '',
          notes: `Deposit — ${supplier.name}`,
        })
      }
      const balance = Math.max(0, amount - action.deposit)
      if (balance > 0 || action.balanceDue) {
        payments.push({
          id: uid('pay'),
          budgetLineId: line.id,
          supplierId: supplier.id,
          kind: 'balance',
          amount: balance,
          dueDate: action.balanceDue,
          paidDate: '',
          notes: `Balance — ${supplier.name}`,
        })
      }
      const runSheet = [
        ...state.runSheet,
        {
          id: uid('rs'),
          time: '',
          title: `${supplier.name} — arrival / setup`,
          owner: supplier.name,
          notes: 'Added when you booked this supplier. Fine-tune times in the run sheet (coming next).',
          supplierId: supplier.id,
        },
      ]
      return touch({
        ...state,
        suppliers: state.suppliers.map((s) =>
          s.id === supplier.id ? { ...s, status: 'booked' } : s,
        ),
        profile:
          supplier.category === 'venue'
            ? { ...state.profile, venueSupplierId: supplier.id }
            : state.profile,
        budgetLines: lines,
        payments,
        runSheet,
      })
    }
    case 'upsertBudgetLine': {
      const exists = state.budgetLines.some((l) => l.id === action.line.id)
      return touch({
        ...state,
        budgetLines: exists
          ? state.budgetLines.map((l) => (l.id === action.line.id ? action.line : l))
          : [...state.budgetLines, action.line],
      })
    }
    case 'removeBudgetLine':
      return touch({
        ...state,
        budgetLines: state.budgetLines.filter((l) => l.id !== action.id),
        payments: state.payments.filter((p) => p.budgetLineId !== action.id),
      })
    case 'addPayment':
      return touch({ ...state, payments: [...state.payments, action.payment] })
    case 'updatePayment':
      return touch({
        ...state,
        payments: state.payments.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      })
    case 'removePayment':
      return touch({ ...state, payments: state.payments.filter((p) => p.id !== action.id) })
    case 'addHousehold':
      return touch({ ...state, households: [...state.households, action.household] })
    case 'updateHousehold':
      return touch({
        ...state,
        households: state.households.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)),
      })
    case 'removeHousehold':
      return touch({
        ...state,
        households: state.households.filter((h) => h.id !== action.id),
        guests: state.guests.filter((g) => g.householdId !== action.id),
      })
    case 'addGuest':
      return touch({ ...state, guests: [...state.guests, action.guest] })
    case 'updateGuest':
      return touch({
        ...state,
        guests: state.guests.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)),
      })
    case 'restoreGuests': {
      // Undo for a removed person or household: put the same records back.
      const households = [...state.households]
      if (action.household && !households.some((h) => h.id === action.household!.id))
        households.splice(Math.min(action.householdIndex ?? households.length, households.length), 0, action.household)
      const ids = new Set(state.guests.map((g) => g.id))
      const back = action.guests.filter((g) => !ids.has(g.id))
      const guests = [...state.guests]
      guests.splice(Math.min(action.guestIndex ?? guests.length, guests.length), 0, ...back)
      return touch({ ...state, households, guests })
    }
    case 'removeGuest':
      return touch({ ...state, guests: state.guests.filter((g) => g.id !== action.id) })
    default:
      return state
  }
}

export type LoadStatus = 'loading' | 'ok' | 'error'

type Ctx = {
  state: AppState
  /** True once loading finished (successfully or not). */
  ready: boolean
  /** 'ok' only when the saved plan was actually read; nothing is saved or synced otherwise. */
  loadStatus: LoadStatus
  dispatch: (action: Action) => void
  /** Tasks that count (not hidden or deleted), with the couple's edits applied. */
  tasks: PlanTask[]
  /** Every task including hidden and deleted ones (for the Plan's "Hidden" filter). */
  allTasks: PlanTask[]
  /** Set (timestamp) when the couple explicitly erased; lets a blank plan be saved/synced. */
  wipeIntent: { current: number }
}

const StoreContext = createContext<Ctx | null>(null)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, emptyState)
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const wipeIntent = useRef(0)
  /** The first committed render after loading holds what we just read: don't write it back. */
  const primed = useRef(false)
  const pending = useRef<{ state: AppState; allowWipe: boolean } | null>(null)

  const dispatch = useCallback((action: Action) => {
    if (action.type === 'eraseAll') wipeIntent.current = Date.now()
    rawDispatch(action)
  }, [])

  // ---- load: retry, and never fall back to a blank plan on failure --------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const saved = await indexedDbStorage.getState()
          if (cancelled) return
          // Hydrate and mark loaded in the same task so React commits them together.
          if (saved?.version === 1) rawDispatch({ type: 'hydrate', state: saved })
          setLoadStatus('ok')
          if (saved && !isBlankPlan(saved)) backupState(saved).catch(() => undefined)
          return
        } catch (e) {
          console.warn('[wedding-planner] could not read saved plan, retrying', e)
          await sleep(300 * (attempt + 1))
        }
      }
      if (!cancelled) setLoadStatus('error')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- save shortly after each change -------------------------------------
  useEffect(() => {
    if (loadStatus !== 'ok') return
    if (!primed.current) {
      primed.current = true
      return
    }
    if (!isBlankPlan(state)) wipeIntent.current = 0
    const allowWipe = wipeIntent.current > 0
    pending.current = { state, allowWipe }
    const t = setTimeout(() => {
      pending.current = null
      indexedDbStorage
        .setState(state, { allowWipe })
        .then(() => backupState(state))
        .catch((e) => console.warn('[wedding-planner] save skipped:', e instanceof Error ? e.message : e))
    }, 250)
    return () => clearTimeout(t)
  }, [state, loadStatus])

  // ---- flush straight away if the app is hidden or closed -------------------
  useEffect(() => {
    const flush = () => {
      const p = pending.current
      if (!p) return
      pending.current = null
      if (!saveStateNow(p.state, p.allowWipe)) {
        indexedDbStorage.setState(p.state, { allowWipe: p.allowWipe }).catch(() => undefined)
      }
    }
    const onVis = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const allTasks = useMemo(() => mergeTasks(state), [state])
  const tasks = useMemo(() => activeTasks(allTasks), [allTasks])
  const ready = loadStatus !== 'loading'
  const value = useMemo(
    () => ({ state, ready, loadStatus, dispatch, tasks, allTasks, wipeIntent }),
    [state, ready, loadStatus, dispatch, tasks, allTasks],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore outside provider')
  return ctx
}

export function newSupplier(partial: Partial<Supplier> & { name: string; category: SupplierCategory }): Supplier {
  return {
    id: uid('sup'),
    area: '',
    website: '',
    phone: '',
    email: '',
    status: 'shortlisted',
    notes: '',
    addedAt: new Date().toISOString(),
    ...partial,
  }
}

export function newGuest(householdId: string, firstName = ''): Guest {
  return {
    id: uid('g'),
    householdId,
    firstName,
    lastName: '',
    isPlusOne: false,
    plusOneNamed: true,
    child: false,
    invitedTo: ['day', 'evening'],
    rsvp: 'pending',
    meal: '',
    dietary: '',
    dietaryConsent: false,
    travelFrom: '',
    notes: '',
  }
}

export function newHousehold(name: string): Household {
  return { id: uid('hh'), name, side: 'both' }
}

