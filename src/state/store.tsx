import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { seedBudget } from '../data/budgetSeeds'
import { mergeTasks } from '../data/checklist'
import { applyTaskDetail } from '../data/taskDetails'
import { uid } from '../lib/ids'
import { indexedDbStorage } from '../storage/indexeddb'
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
  totalBudget: 18000,
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
  | { type: 'addCustomTask'; title: string; stage: string; template?: TemplateId }
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
  | { type: 'importState'; state: AppState }
  | { type: 'reset' }

function touch(state: AppState): AppState {
  return { ...state, updatedAt: new Date().toISOString() }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
    case 'importState':
      return { ...emptyState(), ...action.state, version: 1 }
    case 'reset':
      return emptyState()
    case 'patchProfile':
      return touch({ ...state, profile: { ...state.profile, ...action.patch } })
    case 'completeOnboarding': {
      const profile = { ...action.profile, onboardingComplete: true }
      return touch({
        ...state,
        profile,
        budgetLines: state.budgetLines.length
          ? state.budgetLines
          : seedBudget(profile.totalBudget, profile.bufferPercent),
      })
    }
    case 'setDate':
      return touch({ ...state, profile: { ...state.profile, date: action.date } })
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
        taskDone: { ...state.taskDone, [action.key]: !state.taskDone[action.key] },
      })
    case 'setTaskDone':
      if (!!state.taskDone[action.key] === action.done) return state
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
      const key = `custom_${uid('t')}`
      const task = {
        id: key,
        key,
        title: action.title,
        body: '',
        stage: action.stage,
        dueDate: '',
        officialUrl: '',
        officialLabel: '',
        legal: false,
        custom: true,
        done: false,
        template: action.template ?? 'generic',
      }
      return touch({ ...state, tasks: [...state.tasks, task] })
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
    case 'removeGuest':
      return touch({ ...state, guests: state.guests.filter((g) => g.id !== action.id) })
    default:
      return state
  }
}

type Ctx = {
  state: AppState
  ready: boolean
  dispatch: (action: Action) => void
  tasks: ReturnType<typeof mergeTasks>
}

const StoreContext = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, emptyState)
  const [ready, setReady] = useState(false)
  const skipSave = useRef(true)

  useEffect(() => {
    indexedDbStorage
      .getState()
      .then((saved) => {
        if (saved?.version === 1) dispatch({ type: 'hydrate', state: saved })
        setReady(true)
        setTimeout(() => {
          skipSave.current = false
        }, 0)
      })
      .catch(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready || skipSave.current) return
    const t = setTimeout(() => {
      indexedDbStorage.setState(state).catch(() => undefined)
    }, 250)
    return () => clearTimeout(t)
  }, [state, ready])

  const tasks = useMemo(() => mergeTasks(state), [state])
  const value = useMemo(() => ({ state, ready, dispatch, tasks }), [state, ready, tasks])
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

