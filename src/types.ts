export type Role = 'owner' | 'partner' | 'helper'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'any'
export type CeremonyType = 'civil' | 'religious' | 'humanist' | 'undecided'
export type StyleTag =
  | 'classic'
  | 'rustic'
  | 'garden'
  | 'castle'
  | 'modern'
  | 'intimate'
  | 'other'
export type SupplierCategory =
  | 'venue'
  | 'officiant'
  | 'photographer'
  | 'videographer'
  | 'catering'
  | 'florist'
  | 'entertainment'
  | 'cake'
  | 'attire'
  | 'hair'
  | 'makeup'
  | 'transport'
  | 'stationery'
  | 'decor'
  | 'planner'
  | 'other'
export type SupplierStatus =
  | 'shortlisted'
  | 'enquired'
  | 'quoted'
  | 'viewed'
  | 'booked'
  | 'rejected'
export type RsvpStatus = 'pending' | 'yes' | 'no' | 'maybe'
export type InvitePart = 'day' | 'evening'
export type DateAvailability = 'unknown' | 'available' | 'unavailable' | 'hold'
export type PaymentKind = 'deposit' | 'balance' | 'instalment' | 'other'

export interface WeddingProfile {
  partnerAName: string
  partnerBName: string
  area: string
  style: StyleTag
  season: Season
  estimatedDayGuests: number
  estimatedEveningGuests: number
  totalBudget: number
  bufferPercent: number
  ceremonyType: CeremonyType
  previouslyMarried: boolean
  date?: string
  candidateDates: string[]
  venueSupplierId?: string
  onboardingComplete: boolean
}

export interface Household {
  id: string
  name: string
  side: 'a' | 'b' | 'both'
  email?: string
  address?: string
  notes?: string
}

export interface Guest {
  id: string
  householdId: string
  firstName: string
  lastName: string
  isPlusOne: boolean
  plusOneOfGuestId?: string
  plusOneNamed: boolean
  child: boolean
  invitedTo: InvitePart[]
  rsvp: RsvpStatus
  meal: string
  dietary: string
  dietaryConsent: boolean
  travelFrom: string
  notes: string
}

export interface WeddingEvent {
  id: string
  kind: 'ceremony' | 'breakfast' | 'evening' | 'other'
  name: string
  start?: string
}

/** Northern Ireland's 11 councils (registrar districts). */
export type CouncilId = 'anbc' | 'andbc' | 'abc' | 'belfast' | 'ccg' | 'dcsd' | 'fodc' | 'lcc' | 'mea' | 'mu' | 'nmd'

export interface Supplier {
  id: string
  catalogueId?: string
  /** Google Places id — the only Places field we keep (Google allows caching it); everything else is fetched fresh. */
  placeId?: string
  name: string
  category: SupplierCategory
  area: string
  /** Registrar council for a venue, when the couple picked it (otherwise worked out from the area). */
  council?: CouncilId
  website: string
  phone: string
  email: string
  status: SupplierStatus
  notes: string
  addedAt: string
}

export interface Quote {
  id: string
  supplierId: string
  label: string
  amount: number
  vatIncluded: boolean
  vatRate: number
  inclusions: string
  exclusions: string
  extrasNotes: string
  hiddenExtras: Record<string, string>
  validUntil: string
  receivedAt: string
}

export interface BudgetLine {
  id: string
  category: SupplierCategory | 'legal' | 'insurance' | 'buffer' | 'other'
  name: string
  estimate: number
  quoted: number
  actual: number
  vatIncluded: boolean
  supplierId?: string
  /** Set when a checklist task's details created or adopted this line. */
  taskKey?: string
  notes: string
}

export interface Payment {
  id: string
  budgetLineId: string
  supplierId?: string
  kind: PaymentKind
  amount: number
  dueDate: string
  paidDate: string
  notes: string
  /** Set when a checklist task's details created or adopted this payment. */
  taskKey?: string
}

export type TemplateId =
  | 'booking'
  | 'purchase'
  | 'admin'
  | 'guests'
  | 'decision'
  | 'vision'
  | 'research'
  | 'legal-notice'
  | 'legal-appointment'
  | 'legal-docs'
  | 'legal-officiant'
  | 'legal-schedule'
  | 'legal-witnesses'
  | 'legal-certificates'
  | 'legal-info'
  | 'generic'

/**
 * What you noted when doing a checklist task. One record per task, id-keyed so
 * the sync merge can reconcile it; `values` merge field by field.
 * All values are strings (money as pounds, dates as YYYY-MM-DD, ticks as 'true').
 */
export interface TaskDetail {
  id: string
  taskKey: string
  template: TemplateId
  values: Record<string, string>
  supplierId?: string
  budgetLineId?: string
  updatedAt: string
}

export interface Task {
  id: string
  key: string
  title: string
  body: string
  stage: string
  dueDate: string
  officialUrl: string
  officialLabel: string
  legal: boolean
  custom: boolean
  done: boolean
  /** Custom tasks choose a details template; built-in tasks map by key. */
  template?: TemplateId
}

export interface SeatingTable {
  id: string
  name: string
  seats: number
  shape: 'round' | 'rect'
}

export interface SeatingAssignment {
  guestId: string
  tableId: string
  seat?: number
}

export interface SeatingRule {
  id: string
  kind: 'together' | 'apart'
  guestAId: string
  guestBId: string
}

export interface RunSheetItem {
  id: string
  time: string
  title: string
  owner: string
  notes: string
  supplierId?: string
}

export interface Gift {
  id: string
  householdId?: string
  guestId?: string
  description: string
  thankYouSent: boolean
}

export interface MoodItem {
  id: string
  title: string
  note: string
  url: string
}

export interface VenueDateMark {
  supplierId: string
  date: string
  availability: DateAvailability
}

export interface AppState {
  version: 1
  profile: WeddingProfile
  households: Household[]
  guests: Guest[]
  events: WeddingEvent[]
  suppliers: Supplier[]
  quotes: Quote[]
  budgetLines: BudgetLine[]
  payments: Payment[]
  tasks: Task[]
  taskDone: Record<string, boolean>
  seatingTables: SeatingTable[]
  seatingAssignments: SeatingAssignment[]
  seatingRules: SeatingRule[]
  runSheet: RunSheetItem[]
  gifts: Gift[]
  moodBoard: MoodItem[]
  venueDates: VenueDateMark[]
  taskDetails: TaskDetail[]
  updatedAt: string
}

export interface CatalogueSupplier {
  id: string
  name: string
  category: SupplierCategory
  area: string
  website: string
  phone?: string
  note?: string
  source: string
  sourceUrl: string
}

export interface StorageAdapter {
  getState(): Promise<AppState | null>
  setState(state: AppState): Promise<void>
}
