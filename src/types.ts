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
  /** Day the current wedding date was set; worked-out dates before it show as "catch up". */
  datesFrom?: string
  /** The plan's one currency for every amount the couple types (default £). Official fees stay in £. */
  currency?: 'GBP' | 'EUR'
}

export interface Household {
  id: string
  name: string
  side: 'a' | 'b' | 'both'
  /** One group per household, e.g. "Matt's family", "Uni friends". */
  group?: string
  /**
   * Contact details are private: for posting invitations only. They sync only to the couple's own
   * paired phone, never appear in enquiry drafts, the guest list view or the default export.
   */
  email?: string
  phone?: string
  address?: string
  postcode?: string
  notes?: string
  /** Manual ticks by the couple. There are no RSVP links or guest-facing pages. */
  saveDateSent?: boolean
  inviteSent?: boolean
  inviteSentOn?: string
  addedAt?: string
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
  /** ['day', 'evening'] for a day guest, ['evening'] for evening only. */
  invitedTo: InvitePart[]
  /** Only 'no' matters now: the couple marking someone as not coming. No RSVP pages exist. */
  rsvp: RsvpStatus
  meal: string
  dietary: string
  dietaryConsent: boolean
  travelFrom: string
  notes: string
  tags?: string[]
  addedAt?: string
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
  // ---- the couple's own edits (on a custom task, or on a built-in task's override record) ----
  /** Their own title for a built-in task. */
  titleOverride?: string
  /** Their own due date (YYYY-MM-DD) for a built-in task; always wins over the worked-out one. */
  dueOverride?: string
  /** Their own notes. */
  notes?: string
  /** Who's doing it: partner A, partner B, or both. */
  assignee?: Assignee
  /** Hidden from the list (still shown under "Hidden"). */
  hidden?: boolean
  /** A built-in task the couple deleted (custom tasks are removed outright). */
  removed?: boolean
  /** Manual position within a date group, as an offset in days from the due date. */
  rankDate?: number
  /** Manual position within a stage. */
  rankStage?: number
}

export type Assignee = 'a' | 'b' | 'both'

/** What a task looks like on screen: catalogue + rules + the couple's edits. */
export interface PlanTask extends Task {
  /** Catch-up threshold for this task when it differs from the plan's (dates that existed before the fuller checklist). */
  graceBefore?: string
  /** The worked-out date before any override (empty when there's no wedding date). */
  suggestedDue: string
  /** True when the date came from a legal rule (notice periods etc.). */
  ruleDated: boolean
  /** Had a deadline before the fuller checklist (or the couple set it): past dates show as overdue, not "catch up". */
  strict: boolean
  /** Position in the built-in list (custom tasks after). */
  index: number
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
