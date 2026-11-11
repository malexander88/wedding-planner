import type { AppState, PlanTask, Task, WeddingProfile } from '../types'
import { CATALOGUE_TASKS, type Lead } from './taskCatalogue'
import {
  LINKS,
  addDays,
  addMonths,
  formatShort,
  noticeDueDate,
  noticeMinimumDate,
  scheduleFromDate,
  scheduleReturnDate,
} from './legal'

export const STAGES = [
  { id: 'vision', title: 'Set your vision', blurb: 'Agree the feel, the money and a rough guest number.' },
  { id: 'venue', title: 'Find a venue', blurb: 'Shortlist places that fit your area, style and numbers.' },
  { id: 'date', title: 'Compare dates', blurb: 'Weigh up Saturdays, weekdays, holidays and registrar fees.' },
  { id: 'book', title: 'Book the big pieces', blurb: 'Venue first, then photographer, music and the rest — they go quickly.' },
  { id: 'people', title: 'Guests', blurb: 'Households, day and evening, travel, rooms and replies.' },
  { id: 'legal', title: 'Get the legal side ready', blurb: 'Northern Ireland notice, documents and the marriage schedule.' },
  { id: 'details', title: 'The details', blurb: 'Outfits, rings, stationery, music and how the day will run.' },
  { id: 'final', title: 'The last month', blurb: 'Balances, confirmations, rehearsal and packing.' },
  { id: 'after', title: 'After the wedding', blurb: 'Thank-yous, certificates and name changes.' },
]

/**
 * strict: a missed date is always overdue (legal deadlines, and dates the couple chose).
 * legacyDated: dated before the fuller checklist, so missing it is overdue unless the wedding date
 * was only set after it had already passed.
 */
type Spec = Omit<Task, 'id' | 'done'> & { ruleDated?: boolean; strict?: boolean; legacyDated?: boolean }

function spec(
  partial: Pick<Spec, 'key' | 'title' | 'stage'> & Partial<Omit<Spec, 'key' | 'title' | 'stage' | 'custom'>>,
): Spec {
  return { body: '', dueDate: '', officialUrl: '', officialLabel: '', legal: false, custom: false, ...partial }
}

/** Due date for a lead time worked back from the wedding. */
export function dueFromLead(date: string, lead: Lead): string {
  let d = lead.m ? addMonths(date, -lead.m) : date
  if (lead.w) d = addDays(d, -7 * lead.w)
  return d
}

/** Legal steps: dated by rule from the notice date once the wedding date is known. */
function legalSpecs(profile: WeddingProfile): Spec[] {
  const items: Spec[] = []
  const date = profile.date
  const rec = date ? noticeDueDate(date, profile.previouslyMarried) : ''
  items.push(
    spec({
      key: 'legal-learn',
      title: 'Read how giving notice works in Northern Ireland',
      body: 'You give notice to the registrar in the district where you will marry, not necessarily where you live. That is different from England and Wales.',
      stage: 'legal',
      legal: true,
      dueDate: date ? addDays(rec, -56) : '',
      ruleDated: !!date,
      officialUrl: LINKS.notice,
      officialLabel: 'nidirect: how and when to give notice',
    }),
    spec({
      key: 'legal-officiant',
      title: 'Speak to your officiant before filling in notice forms',
      body: 'For a religious or humanist ceremony the officiant needs to sign the forms, and must be registered with the Registrar General. For a civil ceremony, book the registrar early.',
      stage: 'legal',
      legal: true,
      dueDate: date ? addDays(rec, -28) : '',
      ruleDated: !!date,
      officialUrl: LINKS.anbcMarriages,
      officialLabel: 'ANBC marriages page',
    }),
    spec({
      key: 'legal-docs',
      title: 'Gather the documents for notice',
      body: 'Each of you needs the long birth or adoption certificate and a passport. Extra documents apply if either of you has been married or in a civil partnership before. Do not upload scans into this app — just tick this off when the originals are ready.',
      stage: 'legal',
      legal: true,
      dueDate: date ? addDays(rec, -21) : '',
      ruleDated: !!date,
      officialUrl: LINKS.noticeForm,
      officialLabel: 'Download the GRO446 notice form',
    }),
  )
  if (!date) return items

  const min = noticeMinimumDate(date)
  const schedFrom = scheduleFromDate(date)
  const ret = scheduleReturnDate(date)
  // These had deadlines before the fuller checklist, so a missed one is genuinely overdue.
  const strict = { ruleDated: true, strict: true }
  items.push(
    spec({
      key: 'legal-book-appointment',
      title: 'Book an appointment to give notice',
      body: `Registrars give notice by appointment, and slots go a few weeks out. In Antrim & Newtownabbey: Mossley Mill, Newtownabbey (028 9034 0180) or Antrim Civic Centre (028 9448 1315). Book about two weeks before you plan to give notice, which should be around ${formatShort(rec)}. The absolute minimum is 28 days before the wedding (${formatShort(min)}), which is risky.`,
      stage: 'legal',
      legal: true,
      dueDate: addDays(rec, -14),
      officialUrl: LINKS.newtownabbey,
      officialLabel: 'Newtownabbey registrar',
      ...strict,
    }),
    spec({
      key: 'legal-give-notice',
      title: profile.previouslyMarried
        ? 'Give notice (recommended 10 weeks before)'
        : 'Give notice (recommended 8 weeks before)',
      body: `Both of you send a separate notice form to the registrar for the district where you will marry. The fee published on nidirect is £22 per form. Notice can only be given in the 12 months before the wedding and lasts 12 months. If an immigration check is needed, notice can stretch to 70 days.`,
      stage: 'legal',
      legal: true,
      dueDate: rec,
      officialUrl: LINKS.notice,
      officialLabel: 'nidirect: giving notice',
      ...strict,
    }),
    spec({
      key: 'legal-schedule-collect',
      title: 'Collect the marriage schedule',
      body: `No ceremony can go ahead without it. It cannot be issued more than 14 days before the wedding (from ${formatShort(schedFrom)}) and only one of you can collect it — not a relative or friend. For a civil ceremony the registrar usually brings it.`,
      stage: 'legal',
      legal: true,
      dueDate: schedFrom,
      officialUrl: LINKS.religious,
      officialLabel: 'nidirect: the marriage schedule',
      ...strict,
    }),
    spec({
      key: 'legal-witnesses',
      title: 'Ask two witnesses (aged 16 or over)',
      body: 'They sign the schedule with you and the officiant or registrar after the ceremony.',
      stage: 'legal',
      legal: true,
      dueDate: date,
      officialUrl: LINKS.civil,
      officialLabel: 'nidirect: civil ceremony',
      ...strict,
    }),
  )
  if (profile.ceremonyType === 'religious' || profile.ceremonyType === 'humanist') {
    items.push(
      spec({
        key: 'legal-schedule-return',
        title: 'Return the signed schedule within 3 days',
        body: `After a religious or humanist ceremony, take or post the signed schedule back to the issuing registrar by ${formatShort(ret)}. If it is not returned you cannot order a certified copy. Anyone can return it. After a civil ceremony the registrar keeps it.`,
        stage: 'legal',
        legal: true,
        dueDate: ret,
        officialUrl: LINKS.registration,
        officialLabel: 'nidirect: registering your marriage',
        ...strict,
      }),
    )
  }
  items.push(
    spec({
      key: 'legal-certificates',
      title: 'Order extra marriage certificates if you need them',
      body: 'Useful if you plan to change a name or need several originals.',
      stage: 'legal',
      legal: true,
      dueDate: ret,
      officialUrl: LINKS.certificate,
      officialLabel: 'Order a marriage certificate',
      ...strict,
    }),
  )
  return items
}

/** The built-in checklist for this profile: catalogue (dated by lead time) plus the legal steps. */
export function generatedSpecs(profile: WeddingProfile): Spec[] {
  const date = profile.date
  const items: Spec[] = CATALOGUE_TASKS.map((c) =>
    spec({
      key: c.key,
      title: c.title,
      body: c.body,
      stage: c.stage,
      legal: !!c.legal,
      template: c.template,
      officialUrl: c.officialUrl ?? '',
      officialLabel: c.officialLabel ?? '',
      dueDate: date && c.lead ? dueFromLead(date, c.lead) : '',
    }),
  )
  // Legal steps sit before "the details" in the staged list.
  const at = items.findIndex((i) => i.stage === 'details')
  items.splice(at, 0, ...legalSpecs(profile))
  if (date) {
    // Save-the-dates and invitations had rule dates before; keep them exactly.
    const legacy: Spec[] = [
      spec({
        key: 'people-savethedates',
        title: 'Send save-the-dates',
        body: 'Usually six to twelve months ahead, and earlier still if guests are travelling from Great Britain or further.',
        stage: 'people',
        dueDate: addMonths(date, -9),
        legacyDated: true,
      }),
      spec({
        key: 'people-invites',
        title: 'Send invitations',
        body: 'About eight to ten weeks before is typical; earlier if people need to book travel. Ask for meal choices and dietary needs.',
        stage: 'people',
        dueDate: noticeDueDate(date, false),
        legacyDated: true,
      }),
    ]
    const after = items.findIndex((i) => i.key === 'people-gift-list')
    items.splice(after + 1, 0, ...legacy)
  }
  return items
}

/**
 * Tasks the plan's own data already answers. Used only when the couple hasn't
 * ticked or unticked the task themselves, so nothing is written for it.
 */
export function derivedDone(state: AppState, key: string): boolean {
  const p = state.profile
  if (key === 'vision-budget') return p.totalBudget > 0
  if (key === 'vision-guests') return p.onboardingComplete && p.estimatedDayGuests > 0
  if (key === 'date-compare') return Boolean(p.date)
  return false
}

export function isTaskDone(state: AppState, key: string): boolean {
  const explicit = state.taskDone[key]
  if (explicit !== undefined) return explicit
  const legacy = state.tasks.find((t) => t.key === key)?.done
  return legacy || derivedDone(state, key)
}

/** Fields the couple can change on any task. Kept on the task record (custom) or an override record (built-in). */
export const EDIT_FIELDS = ['titleOverride', 'dueOverride', 'notes', 'assignee', 'hidden', 'removed', 'rankDate', 'rankStage'] as const
export type TaskEdits = Partial<Pick<Task, (typeof EDIT_FIELDS)[number] | 'title' | 'stage' | 'template'>>

/**
 * Override records for built-in tasks share the `tasks` list — and its per-record, per-field
 * sync clocks and tombstones — with custom tasks. Older app versions ignore non-custom records.
 */
export const overrideId = (key: string) => `task_${key}`

/**
 * Every task with the couple's edits applied: built-in (catalogue + legal rules) first, then custom.
 * Hidden and removed tasks are included, flagged; use `activeTasks` for counts and Home.
 */
export function mergeTasks(state: AppState): PlanTask[] {
  const specs = generatedSpecs(state.profile)
  const existing = new Map(state.tasks.map((t) => [t.key, t]))
  const merged: PlanTask[] = specs.map((s, index) => {
    const { ruleDated, strict, legacyDated, ...base } = s
    const o = existing.get(s.key)
    return {
      ...base,
      ...(o ? pickEdits(o) : {}),
      id: o?.id ?? overrideId(s.key),
      title: o?.titleOverride?.trim() || base.title,
      dueDate: o?.dueOverride || base.dueDate,
      done: state.taskDone[s.key] ?? (o?.done || derivedDone(state, s.key)),
      suggestedDue: base.dueDate,
      ruleDated: !!ruleDated,
      strict: !!strict,
      ...(legacyDated ? { graceBefore: state.profile.datesFrom ?? '' } : {}),
      index,
    }
  })
  const builtIn = new Set(specs.map((s) => s.key))
  for (const t of state.tasks) {
    if (!t.custom || builtIn.has(t.key)) continue
    merged.push({
      ...t,
      dueDate: t.dueDate || '',
      done: state.taskDone[t.key] ?? !!t.done,
      suggestedDue: '',
      ruleDated: false,
      // The couple chose this date themselves, so a missed one is overdue.
      strict: true,
      index: merged.length,
    })
  }
  return merged
}

function pickEdits(o: Task): TaskEdits {
  const out: Record<string, unknown> = {}
  for (const k of EDIT_FIELDS) if (o[k] !== undefined) out[k] = o[k]
  return out as TaskEdits
}

/** Tasks that count: not hidden, not deleted. */
export const activeTasks = <T extends Pick<Task, 'hidden' | 'removed'>>(tasks: T[]) => tasks.filter((t) => !t.hidden && !t.removed)

export function currentStage(state: AppState): string {
  const tasks = activeTasks(mergeTasks(state))
  for (const stage of STAGES) {
    const inStage = tasks.filter((t) => t.stage === stage.id)
    if (inStage.some((t) => !t.done)) return stage.id
  }
  return STAGES[STAGES.length - 1].id
}
