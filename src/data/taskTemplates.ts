import { moneyExact, parseMoney } from '../lib/money'
// Field templates for the details you note when ticking off a checklist task.
// Each built-in task maps to a template (and, for bookings, a supplier category);
// custom tasks pick one. Values are stored as strings in TaskDetail.values.

import type { BudgetLine, SupplierCategory, Task, TemplateId, WeddingProfile } from '../types'
import { formatShort } from './legal'
import { CATALOGUE_TASKS } from './taskCatalogue'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'money'
  | 'number'
  | 'date'
  | 'time'
  | 'tel'
  | 'email'
  | 'url'
  | 'check'
  | 'select'
  | 'supplier'

export interface FieldDef {
  k: string
  label: string
  type: FieldType
  placeholder?: string
  hint?: string
  options?: { value: string; label: string }[]
  /** Two fields marked half sit side by side. */
  half?: boolean
  /** Show this date on Home as a reminder. */
  remind?: boolean
  /** Shown in the done-summary when a tick field is true. */
  onLabel?: string
  when?: (ctx: FieldCtx) => boolean
}

export interface FieldCtx {
  values: Record<string, string>
  profile: WeddingProfile
}

export interface SectionDef {
  title: string
  fields: FieldDef[]
}

/** Which values drive Budget lines and payments. */
export interface MoneySpec {
  total: string
  deposit?: string
  depositPaid?: string
  /** Date the remaining amount is due. */
  due?: string
  /** Tick meaning the remaining amount is paid. */
  paidFlag?: string
  /** Value key holding the payee's name, for payment labels. */
  payee?: string
}

export interface TemplateDef {
  id: TemplateId
  label: string
  blurb: string
  sections: SectionDef[]
  money?: MoneySpec
  /** Value keys (in order) for the one-line summary on a done task. */
  summary: string[]
  /** Optional value key whose value is the budget category. */
  categoryKey?: string
  defaultCategory: BudgetLine['category']
  legal?: boolean
}

export const BOOKING_CATEGORIES: { value: SupplierCategory; label: string }[] = [
  { value: 'venue', label: 'Venue' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'videographer', label: 'Videographer' },
  { value: 'catering', label: 'Caterer' },
  { value: 'entertainment', label: 'Band, DJ or musicians' },
  { value: 'florist', label: 'Florist' },
  { value: 'cake', label: 'Cake' },
  { value: 'transport', label: 'Cars & transport' },
  { value: 'hair', label: 'Hair' },
  { value: 'makeup', label: 'Make-up' },
  { value: 'officiant', label: 'Celebrant / officiant' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'attire', label: 'Attire & rings' },
  { value: 'decor', label: 'Decor & hire' },
  { value: 'planner', label: 'Planner' },
  { value: 'other', label: 'Something else' },
]

const PURCHASE_CATEGORIES = [
  { value: 'attire', label: 'Outfit or accessories' },
  { value: 'attire-rings', label: 'Rings' },
  { value: 'decor', label: 'Decor or favours' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'other', label: 'Something else' },
]

const ADMIN_CATEGORIES = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'other-honeymoon', label: 'Honeymoon' },
  { value: 'other-gifts', label: 'Gift list' },
  { value: 'legal', label: 'Name change / documents' },
  { value: 'other', label: 'Something else' },
]

const CEREMONY_OPTIONS = [
  { value: 'civil', label: 'Civil (registrar)' },
  { value: 'religious', label: 'Religious' },
  { value: 'humanist', label: 'Humanist / belief' },
]

const notes: FieldDef = { k: 'notes', label: 'Notes', type: 'textarea' }
const isReligious = (c: FieldCtx) => (c.values.ceremonyType || c.profile.ceremonyType) !== 'civil'

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  booking: {
    id: 'booking',
    label: 'Supplier booking',
    blurb: 'Who you booked, what it costs and when to pay.',
    categoryKey: 'category',
    defaultCategory: 'other',
    money: { total: 'total', deposit: 'deposit', depositPaid: 'depositPaidDate', due: 'balanceDue', paidFlag: 'balancePaid', payee: 'supplierName' },
    summary: ['supplierName', 'total', '$pay', 'bookingRef'],
    sections: [
      {
        title: 'Who',
        fields: [
          { k: 'category', label: 'Type of supplier', type: 'select', options: BOOKING_CATEGORIES },
          { k: 'supplier', label: 'Supplier', type: 'supplier', hint: 'Pick one you shortlisted in Find, or type a new name.' },
          { k: 'contactName', label: 'Contact name', type: 'text', half: true },
          { k: 'phone', label: 'Phone', type: 'tel', half: true },
          { k: 'email', label: 'Email', type: 'email', half: true },
          { k: 'website', label: 'Website', type: 'url', half: true },
        ],
      },
      {
        title: 'Money',
        fields: [
          { k: 'total', label: 'Total price (£)', type: 'money', half: true },
          { k: 'deposit', label: 'Deposit (£)', type: 'money', half: true },
          { k: 'depositPaidDate', label: 'Deposit paid on', type: 'date', half: true },
          { k: 'balanceDue', label: 'Balance due by', type: 'date', half: true, remind: true },
          { k: 'balancePaid', label: 'Balance paid', type: 'check', onLabel: 'paid in full' },
          { k: 'schedule', label: 'Other instalments', type: 'textarea', placeholder: 'e.g. £500 on 1 March, final numbers by 1 May' },
        ],
      },
      {
        title: 'What’s included',
        fields: [
          { k: 'package', label: 'Package / what’s included', type: 'textarea' },
          { k: 'guests', label: 'Guest numbers agreed', type: 'number', half: true },
          { k: 'hours', label: 'Hours / coverage', type: 'text', half: true, placeholder: 'e.g. 10am–midnight' },
        ],
      },
      {
        title: 'Contract',
        fields: [
          { k: 'bookingRef', label: 'Booking / contract ref', type: 'text', half: true },
          { k: 'contractLink', label: 'Contract link or where it’s filed', type: 'text', half: true },
          { k: 'cancellation', label: 'Cancellation and change terms', type: 'textarea' },
          { k: 'pli', label: 'Public liability insurance seen', type: 'check', half: true },
          { k: 'pliExpiry', label: 'PLI expires', type: 'date', half: true, when: (c) => c.values.pli === 'true' },
        ],
      },
      {
        title: 'On the day',
        fields: [
          { k: 'arrival', label: 'Arrival / set-up time', type: 'time', half: true },
          { k: 'finish', label: 'Finish time', type: 'time', half: true },
          { k: 'dayContact', label: 'On-the-day contact', type: 'text' },
          notes,
        ],
      },
    ],
  },

  purchase: {
    id: 'purchase',
    label: 'Something you’re buying',
    blurb: 'Outfits, rings, favours, decor.',
    categoryKey: 'category',
    defaultCategory: 'attire',
    money: { total: 'price', deposit: 'deposit', depositPaid: 'depositPaidDate', due: 'balanceDue', paidFlag: 'paid', payee: 'shop' },
    summary: ['item', 'shop', 'price', '$pay'],
    sections: [
      {
        title: 'What',
        fields: [
          { k: 'category', label: 'Kind', type: 'select', options: PURCHASE_CATEGORIES },
          { k: 'item', label: 'Item', type: 'text', half: true },
          { k: 'shop', label: 'Shop / maker', type: 'text', half: true },
          { k: 'link', label: 'Link', type: 'url' },
        ],
      },
      {
        title: 'Money',
        fields: [
          { k: 'price', label: 'Price (£)', type: 'money', half: true },
          { k: 'deposit', label: 'Deposit (£)', type: 'money', half: true },
          { k: 'depositPaidDate', label: 'Deposit paid on', type: 'date', half: true },
          { k: 'balanceDue', label: 'Balance due by', type: 'date', half: true, remind: true },
          { k: 'paid', label: 'Paid in full', type: 'check', onLabel: 'paid' },
          { k: 'receiptRef', label: 'Order / receipt ref', type: 'text' },
        ],
      },
      {
        title: 'Dates and fittings',
        fields: [
          { k: 'orderDate', label: 'Ordered on', type: 'date', half: true },
          { k: 'deliveryDate', label: 'Delivery / collection', type: 'date', half: true, remind: true },
          { k: 'fitting1', label: 'First fitting', type: 'date', half: true, remind: true },
          { k: 'fitting2', label: 'Final fitting', type: 'date', half: true, remind: true },
          { k: 'size', label: 'Size and alteration notes', type: 'textarea' },
          notes,
        ],
      },
    ],
  },

  admin: {
    id: 'admin',
    label: 'Admin',
    blurb: 'Insurance, honeymoon, gift list, name change.',
    categoryKey: 'category',
    defaultCategory: 'other',
    money: { total: 'cost', due: 'dueDate', paidFlag: 'paid', payee: 'provider' },
    summary: ['provider', 'ref', 'cost', '$pay'],
    sections: [
      {
        title: 'Details',
        fields: [
          { k: 'category', label: 'Kind', type: 'select', options: ADMIN_CATEGORIES },
          { k: 'provider', label: 'Provider', type: 'text', half: true },
          { k: 'ref', label: 'Policy / booking ref', type: 'text', half: true },
          { k: 'cost', label: 'Cost (£)', type: 'money', half: true },
          { k: 'dueDate', label: 'Payment due', type: 'date', half: true, remind: true },
          { k: 'paid', label: 'Paid', type: 'check', onLabel: 'paid' },
          { k: 'startDate', label: 'Starts / travel out', type: 'date', half: true },
          { k: 'endDate', label: 'Ends / travel back', type: 'date', half: true },
          { k: 'link', label: 'Link', type: 'url' },
          notes,
        ],
      },
    ],
  },

  guests: {
    id: 'guests',
    label: 'Guests and invitations',
    blurb: 'Counts, when and how it went out.',
    defaultCategory: 'stationery',
    money: { total: 'cost', paidFlag: 'paid', payee: 'method' },
    summary: ['count', 'dateSent', 'method', 'cost'],
    sections: [
      {
        title: 'Details',
        fields: [
          { k: 'count', label: 'How many (households or guests)', type: 'number', half: true },
          { k: 'dateSent', label: 'Sent on', type: 'date', half: true },
          {
            k: 'method',
            label: 'How',
            type: 'select',
            options: [
              { value: 'Post', label: 'Post' },
              { value: 'Email', label: 'Email' },
              { value: 'Wedding website', label: 'Wedding website' },
              { value: 'By hand', label: 'By hand' },
              { value: 'Mixed', label: 'A mix' },
            ],
          },
          { k: 'cost', label: 'Cost — printing and postage (£)', type: 'money', half: true },
          { k: 'paid', label: 'Paid', type: 'check', half: true, onLabel: 'paid' },
          { k: 'rsvpBy', label: 'Reply by', type: 'date', half: true, remind: true },
          { k: 'chased', label: 'Non-replies chased on', type: 'date', half: true },
          notes,
        ],
      },
    ],
  },

  decision: {
    id: 'decision',
    label: 'Date and place decision',
    blurb: 'The date, times and where things happen.',
    defaultCategory: 'venue',
    summary: ['chosenDate', 'ceremonyTime', 'ceremonyLocation', 'capacityDay'],
    sections: [
      {
        title: 'The decision',
        fields: [
          { k: 'chosenDate', label: 'Chosen date', type: 'date', half: true },
          { k: 'ceremonyTime', label: 'Ceremony time', type: 'time', half: true },
          { k: 'useAsDate', label: 'Make this our wedding date (turns on the dated checklist)', type: 'check' },
          { k: 'ceremonyLocation', label: 'Ceremony location', type: 'text', half: true },
          { k: 'receptionLocation', label: 'Reception location', type: 'text', half: true },
          { k: 'capacityDay', label: 'Day capacity', type: 'number', half: true },
          { k: 'capacityEvening', label: 'Evening capacity', type: 'number', half: true },
          notes,
        ],
      },
    ],
  },

  vision: {
    id: 'vision',
    label: 'Budget and numbers',
    blurb: 'The figures you agreed. Saving updates your settings.',
    defaultCategory: 'other',
    summary: ['workingBudget', 'dayGuests', 'eveningGuests'],
    sections: [
      {
        title: 'What you agreed',
        fields: [
          { k: 'workingBudget', label: 'Total budget (£)', type: 'money' },
          { k: 'dayGuests', label: 'Day guests', type: 'number', half: true },
          { k: 'eveningGuests', label: 'Extra evening guests', type: 'number', half: true },
          { k: 'priorities', label: 'Top priorities', type: 'textarea', placeholder: 'e.g. great food, a band, photos' },
          notes,
        ],
      },
    ],
  },

  research: {
    id: 'research',
    label: 'Research and viewings',
    blurb: 'Places on the list and when you’re seeing them.',
    defaultCategory: 'venue',
    summary: ['viewingPlace', 'viewingDate', 'viewingTime'],
    sections: [
      {
        title: 'Details',
        fields: [
          { k: 'shortlist', label: 'On the list', type: 'textarea' },
          { k: 'viewingPlace', label: 'Next viewing — where', type: 'text' },
          { k: 'viewingDate', label: 'Viewing date', type: 'date', half: true, remind: true },
          { k: 'viewingTime', label: 'Time', type: 'time', half: true },
          { k: 'questions', label: 'Questions to ask', type: 'textarea' },
          notes,
        ],
      },
    ],
  },

  'legal-info': {
    id: 'legal-info',
    label: 'Legal — notes',
    blurb: 'Anything worth remembering.',
    legal: true,
    defaultCategory: 'legal',
    summary: ['readOn', 'notes'],
    sections: [{ title: 'Notes', fields: [{ k: 'readOn', label: 'Done on', type: 'date' }, notes] }],
  },

  'legal-docs': {
    id: 'legal-docs',
    label: 'Documents for notice',
    blurb: 'Tick what’s ready. Never upload scans — keep the originals safe.',
    legal: true,
    defaultCategory: 'legal',
    summary: ['$docs'],
    sections: [
      {
        title: 'Ready to take with you',
        fields: [
          { k: 'birthA', label: 'Partner one — long birth or adoption certificate', type: 'check' },
          { k: 'passportA', label: 'Partner one — passport or other photo ID', type: 'check' },
          { k: 'birthB', label: 'Partner two — long birth or adoption certificate', type: 'check' },
          { k: 'passportB', label: 'Partner two — passport or other photo ID', type: 'check' },
          {
            k: 'previous',
            label: 'Decree absolute / dissolution or death certificate (previous marriage)',
            type: 'check',
            when: (c) => c.profile.previouslyMarried,
          },
          { k: 'forms', label: 'Marriage notice forms filled in (one each)', type: 'check' },
          notes,
        ],
      },
    ],
  },

  'legal-appointment': {
    id: 'legal-appointment',
    label: 'Notice appointment',
    blurb: 'When and where you’re giving notice.',
    legal: true,
    defaultCategory: 'legal',
    summary: ['appointmentDate', 'appointmentTime', 'office'],
    sections: [
      {
        title: 'Appointment',
        fields: [
          { k: 'appointmentDate', label: 'Date', type: 'date', half: true, remind: true },
          { k: 'appointmentTime', label: 'Time', type: 'time', half: true },
          { k: 'office', label: 'Registrar office / council', type: 'text', placeholder: 'e.g. Mossley Mill, Newtownabbey' },
          { k: 'reference', label: 'Booking reference', type: 'text' },
          notes,
        ],
      },
    ],
  },

  'legal-notice': {
    id: 'legal-notice',
    label: 'Giving notice',
    blurb: 'We check your dates against the Northern Ireland rules.',
    legal: true,
    defaultCategory: 'legal',
    money: { total: 'fee', paidFlag: 'feePaid', due: 'noticeDate', payee: 'office' },
    summary: ['noticeDate', 'office', 'reference', 'fee'],
    sections: [
      {
        title: 'Notice',
        fields: [
          { k: 'noticeDate', label: 'Notice given on', type: 'date', half: true },
          { k: 'reference', label: 'Reference number', type: 'text', half: true },
          { k: 'office', label: 'Registrar office / council', type: 'text', placeholder: 'e.g. Antrim & Newtownabbey — Mossley Mill' },
          { k: 'fee', label: 'Fee (£)', type: 'money', half: true, hint: '£22 per notice form on nidirect — £44 for the two of you.' },
          { k: 'feePaid', label: 'Fee paid', type: 'check', half: true, onLabel: 'fee paid' },
          { k: 'ceremonyType', label: 'Ceremony type', type: 'select', options: CEREMONY_OPTIONS, half: true },
          { k: 'officiantName', label: 'Registrar / officiant', type: 'text', half: true },
          notes,
        ],
      },
    ],
  },

  'legal-officiant': {
    id: 'legal-officiant',
    label: 'Officiant',
    blurb: 'Who is marrying you.',
    legal: true,
    defaultCategory: 'officiant',
    money: { total: 'fee', paidFlag: 'feePaid', payee: 'officiantName' },
    summary: ['officiantName', 'ceremonyType', 'fee', 'registered'],
    sections: [
      {
        title: 'Officiant',
        fields: [
          { k: 'ceremonyType', label: 'Ceremony type', type: 'select', options: CEREMONY_OPTIONS, half: true },
          { k: 'officiantName', label: 'Name', type: 'text', half: true },
          { k: 'organisation', label: 'Church / organisation / registrar office', type: 'text' },
          { k: 'phone', label: 'Phone', type: 'tel', half: true },
          { k: 'email', label: 'Email', type: 'email', half: true },
          { k: 'registered', label: 'Registered with the Registrar General', type: 'check', onLabel: 'registered', when: isReligious },
          { k: 'fee', label: 'Fee (£)', type: 'money', half: true },
          { k: 'feePaid', label: 'Fee paid', type: 'check', half: true, onLabel: 'fee paid' },
          notes,
        ],
      },
    ],
  },

  'legal-schedule': {
    id: 'legal-schedule',
    label: 'Marriage schedule',
    blurb: 'Collecting it beforehand and returning it afterwards.',
    legal: true,
    defaultCategory: 'legal',
    summary: ['collectionDate', 'collectedBy', 'returnDate', 'reference'],
    sections: [
      {
        title: 'Schedule',
        fields: [
          { k: 'collectionDate', label: 'Collect on', type: 'date', half: true, remind: true },
          {
            k: 'collectedBy',
            label: 'Collected by',
            type: 'select',
            half: true,
            options: [
              { value: 'Partner one', label: 'Partner one' },
              { value: 'Partner two', label: 'Partner two' },
              { value: 'Registrar brings it', label: 'Registrar brings it (civil)' },
            ],
          },
          { k: 'office', label: 'Issuing registrar office', type: 'text' },
          { k: 'reference', label: 'Reference', type: 'text' },
          { k: 'returnDate', label: 'Returned on', type: 'date', half: true, remind: true, when: isReligious },
          {
            k: 'returnMethod',
            label: 'Returned by',
            type: 'select',
            half: true,
            when: isReligious,
            options: [
              { value: 'In person', label: 'In person' },
              { value: 'Post', label: 'Post' },
            ],
          },
          notes,
        ],
      },
    ],
  },

  'legal-witnesses': {
    id: 'legal-witnesses',
    label: 'Witnesses',
    blurb: 'Two people aged 16 or over.',
    legal: true,
    defaultCategory: 'legal',
    summary: ['witness1', 'witness2'],
    sections: [
      {
        title: 'Witnesses',
        fields: [
          { k: 'witness1', label: 'First witness', type: 'text', half: true },
          { k: 'witness2', label: 'Second witness', type: 'text', half: true },
          { k: 'over16', label: 'Both are 16 or over', type: 'check' },
          notes,
        ],
      },
    ],
  },

  'legal-certificates': {
    id: 'legal-certificates',
    label: 'Marriage certificates',
    blurb: 'Extra copies for name changes and records.',
    legal: true,
    defaultCategory: 'legal',
    money: { total: 'cost', paidFlag: 'paid', due: 'orderDate', payee: 'reference' },
    summary: ['copies', 'cost', 'orderDate'],
    sections: [
      {
        title: 'Certificates',
        fields: [
          { k: 'copies', label: 'Copies ordered', type: 'number', half: true },
          { k: 'cost', label: 'Cost (£)', type: 'money', half: true, hint: '£8 per certified copy.' },
          { k: 'orderDate', label: 'Ordered on', type: 'date', half: true },
          { k: 'paid', label: 'Paid', type: 'check', half: true, onLabel: 'paid' },
          { k: 'reference', label: 'Order reference', type: 'text' },
          notes,
        ],
      },
    ],
  },

  generic: {
    id: 'generic',
    label: 'General',
    blurb: 'Who, how much, when.',
    defaultCategory: 'other',
    money: { total: 'cost', due: 'date', paidFlag: 'paid', payee: 'vendor' },
    summary: ['vendor', 'cost', 'date', 'ref'],
    sections: [
      {
        title: 'Details',
        fields: [
          { k: 'vendor', label: 'Who / where', type: 'text', half: true },
          { k: 'ref', label: 'Reference', type: 'text', half: true },
          { k: 'cost', label: 'Cost (£)', type: 'money', half: true },
          { k: 'date', label: 'Date', type: 'date', half: true, remind: true },
          { k: 'paid', label: 'Paid', type: 'check', onLabel: 'paid' },
          { k: 'link', label: 'Link', type: 'url' },
          notes,
        ],
      },
    ],
  },
}

/** Templates a custom task can choose. */
export const CUSTOM_TEMPLATE_CHOICES: TemplateId[] = ['generic', 'booking', 'purchase', 'admin', 'guests', 'decision', 'research']

/** Built-in task → template, plus fixed starting values (e.g. supplier category). */
const TASK_MAP: Record<string, { template: TemplateId; preset?: Record<string, string> }> = {
  'vision-budget': { template: 'vision' },
  'vision-guests': { template: 'vision' },
  'venue-shortlist': { template: 'research' },
  'venue-viewings': { template: 'research' },
  'date-compare': { template: 'decision' },
  'book-venue': { template: 'booking', preset: { category: 'venue' } },
  'book-photo': { template: 'booking', preset: { category: 'photographer' } },
  'book-music': { template: 'booking', preset: { category: 'entertainment' } },
  'people-households': { template: 'guests' },
  'people-travel': { template: 'guests' },
  'people-savethedates': { template: 'guests' },
  'people-invites': { template: 'guests' },
  'legal-learn': { template: 'legal-info' },
  'legal-docs': { template: 'legal-docs' },
  'legal-officiant': { template: 'legal-officiant' },
  'legal-book-appointment': { template: 'legal-appointment' },
  'legal-give-notice': { template: 'legal-notice' },
  'legal-schedule-collect': { template: 'legal-schedule' },
  'legal-schedule-return': { template: 'legal-schedule' },
  'legal-witnesses': { template: 'legal-witnesses' },
  'legal-certificates': { template: 'legal-certificates' },
  'details-outfits': { template: 'purchase', preset: { category: 'attire' } },
  'details-flowers-cake': { template: 'booking', preset: { category: 'florist' } },
  'details-insurance': { template: 'admin', preset: { category: 'insurance' } },
}

const CATALOGUE_MAP = new Map(CATALOGUE_TASKS.map((c) => [c.key, { template: c.template, preset: c.preset }]))

export function templateFor(task: Pick<Task, 'key' | 'template' | 'legal'>): { template: TemplateDef; preset: Record<string, string> } {
  const mapped = CATALOGUE_MAP.get(task.key) ?? TASK_MAP[task.key]
  if (mapped) return { template: TEMPLATES[mapped.template], preset: mapped.preset ?? {} }
  if (task.template) return { template: TEMPLATES[task.template], preset: {} }
  return { template: TEMPLATES[task.legal ? 'legal-info' : 'generic'], preset: {} }
}

export function allFields(t: TemplateDef): FieldDef[] {
  return t.sections.flatMap((s) => s.fields)
}

/** Budget category for a detail; purchase/admin sub-kinds collapse to real categories. */
export function budgetCategory(t: TemplateDef, values: Record<string, string>): BudgetLine['category'] {
  const raw = (t.categoryKey && values[t.categoryKey]) || t.defaultCategory
  const base = raw.split('-')[0]
  return base as BudgetLine['category']
}

/** A typed amount in the plan's currency (see lib/money). */
export function money(v: string | undefined): number {
  return parseMoney(v)
}

/** Couple-entered amounts, in the plan's currency. */
export const fmtMoney = (n: number) => moneyExact(n)

function formatValue(f: FieldDef, v: string): string {
  if (!v) return ''
  switch (f.type) {
    case 'money':
      return money(v) ? fmtMoney(money(v)) : ''
    case 'date':
      return formatShort(v)
    case 'check':
      return v === 'true' ? f.onLabel ?? '' : ''
    case 'select':
      return f.options?.find((o) => o.value === v)?.label ?? v
    case 'number':
      return f.k === 'count' ? `${v} sent` : f.k === 'copies' ? `${v} copies` : f.k.startsWith('capacity') ? `${v} guests` : f.k.endsWith('Guests') ? `${v} ${f.k === 'dayGuests' ? 'day' : 'evening'}` : v
    case 'textarea':
      return v.length > 40 ? `${v.slice(0, 39).trimEnd()}…` : v
    default:
      return v
  }
}

/** Payment status words for templates with money. */
export function paymentState(t: TemplateDef, values: Record<string, string>): string {
  const m = t.money
  if (!m || !money(values[m.total])) return ''
  if (m.paidFlag && values[m.paidFlag] === 'true') return m.deposit ? 'paid in full' : 'paid'
  if (m.deposit && money(values[m.deposit])) {
    if (m.depositPaid && values[m.depositPaid]) {
      return m.due && values[m.due] ? `deposit paid · balance due ${formatShort(values[m.due])}` : 'deposit paid'
    }
    return 'deposit due'
  }
  return m.due && values[m.due] ? `due ${formatShort(values[m.due])}` : 'to pay'
}

/** One line for a done task, e.g. "Belfast City Hall · £2,400 · deposit paid". */
export function summaryLine(t: TemplateDef, values: Record<string, string>, payState?: string): string {
  const fields = allFields(t)
  const parts: string[] = []
  for (const key of t.summary) {
    if (key === '$pay') {
      const s = payState ?? paymentState(t, values)
      if (s) parts.push(s)
      continue
    }
    if (key === '$docs') {
      const docFields = fields.filter((f) => f.type === 'check')
      const ready = docFields.filter((f) => values[f.k] === 'true').length
      if (ready) parts.push(`${ready} of ${docFields.length} ready`)
      continue
    }
    const f = fields.find((x) => x.k === key)
    if (!f) {
      if (values[key]) parts.push(values[key])
      continue
    }
    // Paid flags are folded into $pay; skip duplicates.
    if (t.summary.includes('$pay') && t.money?.paidFlag === key) continue
    const text = formatValue(f, values[key] ?? '')
    if (text) parts.push(text)
  }
  return parts.slice(0, 4).join(' · ')
}

export function hasAnyValue(values: Record<string, string>): boolean {
  return Object.values(values).some((v) => v !== '' && v !== undefined)
}
