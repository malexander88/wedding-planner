// Supplier enquiry drafts. Drafts only: the couple copies them or opens their own mail app.
// Only plan context leaves the app: the date (or dates), area, style, guest COUNTS and, if they
// choose, a budget band. Never guest names, addresses, contact details or dietary notes.

import { categoryLabel } from '../data/categories'
import { guestCounts, planningNumbers } from '../data/guests'
import { formatLong } from '../data/legal'
import type { AppState, Supplier, SupplierCategory } from '../types'
import { money } from './money'

export type Tone = 'warm' | 'brief' | 'formal'
export const TONES: { id: Tone; label: string; hint: string }[] = [
  { id: 'warm', label: 'Friendly', hint: 'Warm and personal' },
  { id: 'brief', label: 'Short', hint: 'Just the essentials' },
  { id: 'formal', label: 'Formal', hint: 'Polite and businesslike' },
]

export interface EnquiryOptions {
  tone: Tone
  /** A budget band to mention, e.g. "£4,000–£5,000". Empty: say nothing about budget. */
  budget: string
}

export interface Enquiry {
  subject: string
  body: string
}

type Counts = 'all' | 'day' | 'evening' | 'invites' | 'none'

interface CategoryBrief {
  /** "looking for a …" */
  noun: string
  counts: Counts
  /** Most important first: the short tone keeps the first four. */
  ask: string[]
}

const BRIEFS: Record<SupplierCategory, CategoryBrief> = {
  venue: {
    noun: 'wedding venue',
    counts: 'all',
    ask: [
      'whether you are available on the date (or dates) above, and whether you offer exclusive use',
      'whether you can hold our numbers for the day and the evening, and whether the ceremony can take place on site',
      'what your wedding packages include (room hire, drinks, menu, evening food) and what costs extra',
      'your finish time, late bar and any noise limits',
      'whether we can bring in our own suppliers, and any corkage or supplier fees',
      'whether there are bedrooms for guests, and any room block or minimum stay',
      'your deposit and payment schedule, and whether prices include VAT',
    ],
  },
  officiant: {
    noun: 'celebrant or officiant',
    counts: 'none',
    ask: [
      'whether you are available on the date (or dates) above',
      'whether you can legally solemnise the marriage in Northern Ireland, or whether we would also need a civil ceremony',
      'how you write and personalise the ceremony, and how many meetings are included',
      'your fee, travel costs and deposit',
    ],
  },
  photographer: {
    noun: 'wedding photographer',
    counts: 'day',
    ask: [
      'whether you are available on the date (or dates) above',
      'your packages and how many hours of coverage each includes',
      'when and how we would receive the photos (online gallery, prints, album)',
      'whether a second photographer is included or available',
      'travel costs, your deposit and payment schedule',
      'whether prices include VAT',
    ],
  },
  videographer: {
    noun: 'wedding videographer',
    counts: 'day',
    ask: [
      'whether you are available on the date (or dates) above',
      'your packages, film lengths and hours of coverage',
      'whether you record the vows and speeches with separate audio',
      'how long editing takes and how films are delivered',
      'travel costs, your deposit and payment schedule',
    ],
  },
  catering: {
    noun: 'caterer',
    counts: 'all',
    ask: [
      'whether you are available on the date (or dates) above',
      'sample menus and a price per head for our numbers (drinks reception, meal and evening food)',
      'how you handle dietary needs and allergies',
      'whether a tasting is included, and when it would be',
      'staffing, service style and any equipment hire (crockery, linen)',
      'whether prices include VAT and any service charge, and your deposit',
    ],
  },
  florist: {
    noun: 'florist',
    counts: 'day',
    ask: [
      'whether you are available on the date (or dates) above',
      'rough prices for a bouquet, buttonholes and table flowers',
      'which flowers are in season for our date',
      'delivery, venue set-up and collection afterwards',
      'your deposit and when final choices are needed',
    ],
  },
  entertainment: {
    noun: 'band or DJ',
    counts: 'evening',
    ask: [
      'whether you are available on the date (or dates) above',
      'your set lengths and format, and whether you take first-dance and song requests',
      'what equipment you bring, and the space and power you need',
      'whether you hold public liability insurance and PAT-tested equipment (most venues ask)',
      'overtime rates, travel costs and your deposit',
    ],
  },
  cake: {
    noun: 'wedding cake maker',
    counts: 'all',
    ask: [
      'whether you are available on the date (or dates) above',
      'a rough price for a cake serving our numbers, and how portions work',
      'flavours, and options for dietary needs',
      'whether you offer a tasting',
      'delivery, set-up at the venue and stand hire',
    ],
  },
  attire: {
    noun: 'wedding outfit',
    counts: 'none',
    ask: [
      'when you have appointments available',
      'your price range, and what is included (alterations, accessories)',
      'how long ordering and alterations take before our date',
      'your deposit and payment terms',
    ],
  },
  hair: {
    noun: 'wedding hair stylist',
    counts: 'none',
    ask: [
      'whether you are available on the date (or dates) above, including an early start',
      'your prices per person and how many people you can style in a morning',
      'when a trial would be and what it costs',
      'travel to us on the morning, and your deposit',
    ],
  },
  makeup: {
    noun: 'wedding make-up artist',
    counts: 'none',
    ask: [
      'whether you are available on the date (or dates) above, including an early start',
      'your prices per person and how many people you can do in a morning',
      'when a trial would be and what it costs',
      'travel to us on the morning, and your deposit',
    ],
  },
  transport: {
    noun: 'wedding car or transport',
    counts: 'none',
    ask: [
      'whether you have vehicles available on the date (or dates) above',
      'how many hours are included and how the route works (home, ceremony, reception)',
      'whether ribbons or decorations are included',
      'charges for extra mileage or waiting time, and your deposit',
    ],
  },
  stationery: {
    noun: 'wedding stationer',
    counts: 'invites',
    ask: [
      'samples or designs we could look at',
      'prices for our quantities, including envelopes',
      'how proofs work and how long printing takes',
      'whether you can also do on-the-day items (menus, table plan, place cards)',
    ],
  },
  decor: {
    noun: 'décor hire',
    counts: 'day',
    ask: [
      'whether you are available on the date (or dates) above',
      'what you have for hire and rough prices',
      'delivery, set-up and collection times at the venue',
      'any damage deposit and your booking deposit',
    ],
  },
  planner: {
    noun: 'wedding planner',
    counts: 'all',
    ask: [
      'whether you are available on the date (or dates) above',
      'your packages (full planning, partial, on-the-day coordination) and fees',
      'how you work with suppliers and venues we have already chosen',
      'your deposit and payment schedule',
    ],
  },
  other: {
    noun: 'supplier',
    counts: 'day',
    ask: [
      'whether you are available on the date (or dates) above',
      'what is included and your prices',
      'anything else we should budget for',
      'your deposit and payment terms',
    ],
  },
}

const listOf = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

function names(state: AppState): string {
  const p = state.profile
  return [p.partnerAName, p.partnerBName].map((x) => x.trim()).filter(Boolean).join(' and ')
}

function dateWords(state: AppState, tone: Tone): string {
  const p = state.profile
  if (p.date) return tone === 'brief' ? formatLong(p.date) : `on ${formatLong(p.date)}`
  if (p.candidateDates.length) {
    const ds = p.candidateDates.slice(0, 4).map(formatLong)
    return tone === 'brief' ? `one of ${listOf(ds)}` : `on one of these dates: ${ds.join('; ')}`
  }
  if (p.season && p.season !== 'any') return tone === 'brief' ? `${p.season}, date to be fixed` : `in the ${p.season}, though we have not fixed a date yet`
  return tone === 'brief' ? 'date to be fixed' : 'though we have not fixed a date yet'
}

/** Guest numbers as counts only. */
function countWords(state: AppState, kind: Counts): string {
  if (kind === 'none') return ''
  const n = planningNumbers(state)
  const about = n.fromList ? '' : 'around '
  const day = n.day || 0
  const eve = n.evening || 0
  const kids = n.children ? `, including ${n.children} ${n.children === 1 ? 'child' : 'children'}` : ''
  if (kind === 'invites') {
    const c = guestCounts(state)
    const households = state.households.length
    if (households) return `about ${households} invitations (${c.coming} guests)`
    return day ? `${about}${day + eve} guests` : ''
  }
  if (kind === 'evening') return day || eve ? `${about}${day + eve} guests in the evening` : ''
  if (kind === 'day') return day ? `${about}${day} day guests` : ''
  if (!day && !eve) return ''
  return `${about}${day} day guests${eve ? ` and ${eve} more joining in the evening` : ''}${kids}`
}

function venueName(state: AppState, supplier: Supplier): string {
  const id = state.profile.venueSupplierId
  if (!id || id === supplier.id) return ''
  return state.suppliers.find((s) => s.id === id)?.name ?? ''
}

export function buildEnquiry(state: AppState, supplier: Supplier, opts: EnquiryOptions): Enquiry {
  const p = state.profile
  const brief = BRIEFS[supplier.category] ?? BRIEFS.other
  const who = names(state) || 'us'
  const area = p.area?.trim() || 'Belfast / Antrim / Newtownabbey'
  const when = dateWords(state, opts.tone)
  const counts = countWords(state, brief.counts)
  const venue = venueName(state, supplier)
  const ceremony =
    supplier.category === 'venue' && p.ceremonyType && p.ceremonyType !== 'undecided'
      ? `We are planning a ${p.ceremonyType} ceremony.`
      : ''
  const style = p.style ? `${p.style}` : ''
  const budget = opts.budget.trim()
  const subjectDate = p.date ? formatLong(p.date) : p.candidateDates.length ? 'date options' : 'date to be confirmed'
  const subject = `Wedding enquiry: ${who}, ${subjectDate}`
  const qs = opts.tone === 'brief' ? brief.ask.slice(0, 4) : brief.ask

  let body: string
  if (opts.tone === 'brief') {
    const facts = [
      `Date: ${when}`,
      `Area: ${area}${venue ? ` (venue: ${venue})` : ''}`,
      counts ? `Guests: ${counts}` : '',
      budget ? `Budget for this: ${budget}` : '',
    ].filter(Boolean)
    body = `Hi,

We are looking for a ${brief.noun} for our wedding.

${facts.join('\n')}

Could you let us know:
${qs.map((x) => `• ${x}`).join('\n')}

Thanks,
${who}
`
  } else if (opts.tone === 'formal') {
    body = `Dear ${supplier.name} team,

We are writing to enquire about your services as a ${brief.noun}. Our wedding will be in the ${area} area ${when}${venue ? `, at ${venue}` : ''}.${counts ? ` We are expecting ${counts}.` : ''}${ceremony ? ` ${ceremony}` : ''}${style ? ` The style we have in mind is ${style}.` : ''}${budget ? ` Our budget for this is ${budget}.` : ''}

We would be grateful if you could advise:

${qs.map((x) => `• ${x}`).join('\n')}

We would be happy to arrange a call or a meeting at a time convenient to you.

Kind regards,
${who}
`
  } else {
    body = `Hello,

We’re ${who}, and we’re getting married in the ${area} area ${when}${venue ? `, at ${venue}` : ''}.${counts ? ` We’re expecting ${counts}.` : ''}${ceremony ? ` ${ceremony}` : ''}${style ? ` We’re going for a ${style} feel.` : ''}

We came across you while looking for a ${brief.noun} and would love to know:

${qs.map((x) => `• ${x}`).join('\n')}
${budget ? `\nTo give you an idea, our budget for this is ${budget}.\n` : ''}
We’d be happy to have a chat or come and see you at a time that suits.

Thanks so much,
${who}
`
  }
  return { subject, body }
}

/** Old single-string form, used by tests and anything wanting the default draft. */
export function draftEnquiry(state: AppState, supplier: Supplier): string {
  const e = buildEnquiry(state, supplier, { tone: 'warm', budget: '' })
  return `Subject: ${e.subject}\n\n${e.body}`
}

/** A rounded band around what the plan already sets aside for this supplier or category. */
export function suggestBudgetBand(state: AppState, supplier: Supplier): string {
  const lines = state.budgetLines.filter((l) => l.supplierId === supplier.id)
  const cat = lines.length ? lines : state.budgetLines.filter((l) => l.category === supplier.category)
  const amount = cat.reduce((s, l) => s + (l.quoted || l.estimate || 0), 0)
  return amount > 0 ? budgetBand(amount) : ''
}

export function budgetBand(amount: number): string {
  if (!(amount > 0)) return ''
  const step = amount < 1000 ? 100 : amount < 5000 ? 500 : amount < 20000 ? 1000 : 2500
  const lo = Math.max(step, Math.floor((amount * 0.9) / step) * step)
  const hi = Math.max(lo + step, Math.ceil((amount * 1.1) / step) * step)
  return `${money(lo)}–${money(hi)}`
}

/** mailto: link for the user's own mail app (nothing is sent by the app). */
export function mailtoUrl(to: string | undefined, e: Enquiry): string {
  const addr = (to ?? '').trim()
  const safe = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(addr) ? addr : ''
  // Line breaks must be CRLF-encoded in mailto bodies.
  return `mailto:${safe}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body.replace(/\r?\n/g, '\r\n'))}`
}

export const categoryNoun = (c: SupplierCategory) => BRIEFS[c]?.noun ?? categoryLabel(c).toLowerCase()
