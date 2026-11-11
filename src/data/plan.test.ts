import { describe, expect, it } from 'vitest'
import { emptyState, reducer } from '../state/store'
import type { AppState, PlanTask, Task } from '../types'
import { activeTasks, dueFromLead, mergeTasks, overrideId } from './checklist'
import { addDays, addMonths, noticeDueDate, scheduleFromDate } from './legal'
import { catchUpBefore, groupOf, groupTasks, isCatchUp, matchesFilter, movePatch, nextDeadlines, sortTasks } from './plan'
import { CATALOGUE_INTRODUCED, CATALOGUE_TASKS } from './taskCatalogue'
import { TEMPLATES, templateFor } from './taskTemplates'
import { reminders } from './taskDetails'
import { emptyMeta, makeClock, mergeDocs, stampChanges, docsEqual, type SyncDoc } from '../sync/merge'

const plan = (date?: string, extra: Partial<AppState['profile']> = {}): AppState => {
  const s = emptyState()
  s.profile = { ...s.profile, partnerAName: 'Matt', partnerBName: 'Sam', onboardingComplete: true, date, ...extra }
  return s
}
const find = (s: AppState, key: string) => mergeTasks(s).find((t) => t.key === key)!
const DATE = '2027-09-04'

// Keys the app shipped before round 5: ticks and details are stored against these.
const OLD_KEYS = [
  'vision-budget', 'vision-guests', 'venue-shortlist', 'venue-viewings', 'date-compare', 'book-venue', 'book-photo',
  'book-music', 'details-insurance', 'details-outfits', 'details-flowers-cake', 'people-households', 'people-travel',
  'people-savethedates', 'people-invites', 'legal-learn', 'legal-officiant', 'legal-docs', 'legal-book-appointment',
  'legal-give-notice', 'legal-schedule-collect', 'legal-witnesses', 'legal-schedule-return', 'legal-certificates',
]

describe('task catalogue', () => {
  it('has 60–80 tasks with unique keys, known stages and valid templates', () => {
    expect(CATALOGUE_TASKS.length).toBeGreaterThanOrEqual(60)
    expect(CATALOGUE_TASKS.length).toBeLessThanOrEqual(80)
    const keys = CATALOGUE_TASKS.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const t of CATALOGUE_TASKS) {
      expect(TEMPLATES[t.template], t.key).toBeTruthy()
      expect(t.title.length, t.key).toBeGreaterThan(5)
      expect(['vision', 'venue', 'date', 'book', 'people', 'details', 'final', 'after']).toContain(t.stage)
    }
  })
  it('covers what couples expect (minus hen and stag)', () => {
    const text = CATALOGUE_TASKS.map((t) => t.title.toLowerCase()).join(' | ')
    for (const w of ['ring', 'hair', 'make-up', 'invitation', 'transport', 'rooms for guests', 'honeymoon', 'name', 'final numbers', 'speech', 'favour', 'insurance', 'fitting', 'thank'])
      expect(text, w).toContain(w)
    expect(text).not.toMatch(/\bhen\b|\bstag\b/)
  })
  it('keeps every old task key, so existing ticks and details stay attached', () => {
    const keys = new Set(mergeTasks(plan(DATE, { ceremonyType: 'religious' })).map((t) => t.key))
    for (const k of OLD_KEYS) expect(keys.has(k), k).toBe(true)
    const undated = new Set(mergeTasks(plan()).map((t) => t.key))
    for (const k of OLD_KEYS.filter((k) => !k.startsWith('legal-') && k !== 'people-savethedates' && k !== 'people-invites'))
      expect(undated.has(k), k).toBe(true)
  })
  it('details templates resolve for every task', () => {
    for (const t of mergeTasks(plan(DATE))) expect(templateFor(t).template, t.key).toBeTruthy()
    expect(templateFor(find(plan(DATE), 'book-hair')).preset).toBeTruthy()
  })
})

describe('dated plan', () => {
  it('works lead times back from the date', () => {
    const s = plan(DATE)
    expect(find(s, 'book-venue').dueDate).toBe(dueFromLead(DATE, CATALOGUE_TASKS.find((c) => c.key === 'book-venue')!.lead!))
    expect(dueFromLead(DATE, { m: 12 })).toBe('2026-09-04')
    expect(dueFromLead(DATE, { w: 2 })).toBe('2027-08-21')
    expect(dueFromLead(DATE, { m: 1, w: 1 })).toBe(addDays('2027-08-04', -7))
    // Venue well before photographer, photographer before invitations, final numbers in the last weeks.
    expect(find(s, 'book-venue').dueDate < find(s, 'book-photo').dueDate).toBe(true)
    expect(find(s, 'book-photo').dueDate < find(s, 'people-invites').dueDate).toBe(true)
    expect(find(s, 'people-final-numbers').dueDate > addMonths(DATE, -2)).toBe(true)
  })
  it('every task gets a date once the wedding is dated, and none before', () => {
    expect(mergeTasks(plan()).every((t) => !t.dueDate)).toBe(true)
    const undatedCount = mergeTasks(plan(DATE)).filter((t) => !t.dueDate).length
    expect(undatedCount).toBe(0)
  })
  it('legal steps keep their rule-based dates', () => {
    const s = plan(DATE, { ceremonyType: 'religious' })
    const rec = noticeDueDate(DATE, false)
    expect(find(s, 'legal-give-notice').dueDate).toBe(rec)
    expect(find(s, 'legal-book-appointment').dueDate).toBe(addDays(rec, -14))
    expect(find(s, 'legal-schedule-collect').dueDate).toBe(scheduleFromDate(DATE))
    expect(find(s, 'legal-witnesses').dueDate).toBe(DATE)
    expect(find(s, 'legal-schedule-return')).toBeTruthy()
    expect(find(s, 'people-savethedates').dueDate).toBe('2026-12-04')
    expect(find(s, 'people-invites').dueDate).toBe(rec)
    expect(find(s, 'legal-give-notice').strict).toBe(true)
  })
  it('uses the couple’s own date when they set one', () => {
    let s = plan(DATE)
    s = reducer(s, { type: 'editTask', key: 'book-cake', patch: { dueOverride: '2027-03-01' } })
    const t = find(s, 'book-cake')
    expect(t.dueDate).toBe('2027-03-01')
    expect(t.suggestedDue).not.toBe('2027-03-01')
    // Moving the wedding re-dates suggestions but not their override.
    s = reducer(s, { type: 'setDate', date: '2027-10-02' })
    expect(find(s, 'book-cake').dueDate).toBe('2027-03-01')
  })
})

describe('catch up, not a flood of overdue', () => {
  const today = '2026-11-11'
  it('missed worked-out dates show as Catch up; strict and user dates go Overdue', () => {
    const s = plan('2027-06-05', { datesFrom: '2026-11-11' })
    const before = catchUpBefore(s.profile)
    const tasks = mergeTasks(s)
    const venue = tasks.find((t) => t.key === 'book-venue')!
    expect(venue.dueDate < today).toBe(true)
    expect(groupOf(venue, today, before)).toBe('catchup')
    expect(tasks.filter((t) => groupOf(t, today, before) === 'overdue').map((t) => t.key)).toEqual(
      tasks.filter((t) => t.strict && t.dueDate < today).map((t) => t.key),
    )
    // Later, a worked-out date that was in the future when the date was set becomes a real overdue.
    const later = '2027-03-01'
    const insurance = tasks.find((t) => t.key === 'details-rings')!
    if (insurance.dueDate >= before && insurance.dueDate < later) expect(groupOf(insurance, later, before)).toBe('overdue')
    const anyLate = tasks.find((t) => !t.strict && t.dueDate >= before && t.dueDate < later)!
    expect(groupOf(anyLate, later, before)).toBe('overdue')
  })
  it('save-the-dates: overdue on an existing plan, catch up when the date was only just set', () => {
    const fresh = plan('2027-06-05', { datesFrom: '2026-11-11' })
    expect(groupOf(find(fresh, 'people-savethedates'), today, catchUpBefore(fresh.profile))).toBe('catchup')
    const existing = plan('2027-06-05')
    expect(groupOf(find(existing, 'people-savethedates'), today, catchUpBefore(existing.profile))).toBe('overdue')
    // Legal deadlines are never softened.
    const late = plan('2026-12-19', { datesFrom: '2026-11-11' })
    expect(groupOf(find(late, 'legal-give-notice'), today, catchUpBefore(late.profile))).toBe('overdue')
  })
  it('a date the couple chose is overdue when missed', () => {
    let s = plan('2027-06-05', { datesFrom: '2026-11-11' })
    s = reducer(s, { type: 'editTask', key: 'book-cake', patch: { dueOverride: '2026-11-01' } })
    expect(groupOf(find(s, 'book-cake'), today, catchUpBefore(s.profile))).toBe('overdue')
  })
  it('setting or moving the wedding date restarts the catch-up clock', () => {
    let s = plan()
    s = reducer(s, { type: 'setDate', date: '2027-06-05' })
    expect(s.profile.datesFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const unchanged = reducer(s, { type: 'patchProfile', patch: { partnerAName: 'Matthew' } })
    expect(unchanged.profile.datesFrom).toBe(s.profile.datesFrom)
    expect(catchUpBefore({})).toBe(CATALOGUE_INTRODUCED)
    const loaded = reducer(plan(), { type: 'hydrate', state: plan('2027-06-05') })
    expect(loaded.profile.datesFrom).toBeUndefined()
  })
  it('Home and reminders skip catch-up items', () => {
    const s = plan('2027-06-05', { datesFrom: '2026-11-11' })
    const before = catchUpBefore(s.profile)
    const tasks = activeTasks(mergeTasks(s))
    for (const t of nextDeadlines(tasks, today, before)) expect(isCatchUp(t, today, before)).toBe(false)
    const catchUp = new Set(tasks.filter((t) => isCatchUp(t, today, before)).map((t) => t.title))
    expect(catchUp.size).toBeGreaterThan(5)
    const shown = reminders(s, tasks, today, 3650).filter((r) => r.kind === 'task')
    expect(shown.some((r) => catchUp.has(r.title))).toBe(false)
  })
})

describe('editing tasks', () => {
  it('edits, hides, deletes and restores built-in tasks; ticks and details survive', () => {
    let s = plan(DATE)
    s = reducer(s, { type: 'setTaskDone', key: 'book-venue', done: true })
    s = reducer(s, { type: 'editTask', key: 'book-venue', patch: { title: 'Book Galgorm', notes: 'Ask about Sundays', assignee: 'b' } })
    let t = find(s, 'book-venue')
    expect(t).toMatchObject({ title: 'Book Galgorm', notes: 'Ask about Sundays', assignee: 'b', done: true })
    expect(s.tasks.find((x) => x.key === 'book-venue')?.id).toBe(overrideId('book-venue'))
    s = reducer(s, { type: 'editTask', key: 'book-venue', patch: { hidden: true } })
    expect(activeTasks(mergeTasks(s)).some((x) => x.key === 'book-venue')).toBe(false)
    s = reducer(s, { type: 'editTask', key: 'book-venue', patch: { hidden: undefined } })
    s = reducer(s, { type: 'removeTask', key: 'book-venue' })
    expect(find(s, 'book-venue').removed).toBe(true)
    s = reducer(s, { type: 'editTask', key: 'book-venue', patch: { removed: undefined } })
    t = find(s, 'book-venue')
    expect(t.removed).toBeUndefined()
    expect(t.done).toBe(true)
    expect(t.title).toBe('Book Galgorm')
  })
  it('does nothing (no write, no sync) when nothing changed', () => {
    const s = plan(DATE)
    const title = find(s, 'book-venue').title
    expect(reducer(s, { type: 'editTask', key: 'book-venue', patch: { title } })).toBe(s)
    expect(reducer(s, { type: 'editTask', key: 'book-venue', patch: { dueOverride: find(s, 'book-venue').suggestedDue } })).toBe(s)
    const edited = reducer(s, { type: 'editTask', key: 'book-venue', patch: { notes: 'x' } })
    expect(reducer(edited, { type: 'editTask', key: 'book-venue', patch: { notes: 'x' } })).toBe(edited)
    expect(reducer(s, { type: 'editTask', key: 'nope', patch: { notes: 'x' } })).toBe(s)
  })
  it('adds, edits, deletes and undoes custom tasks', () => {
    let s = plan(DATE)
    s = reducer(s, { type: 'addCustomTask', title: 'Book a ceilidh caller', stage: 'book', template: 'booking', dueDate: '2027-02-01', assignee: 'both', key: 'custom_x' })
    let t = find(s, 'custom_x')
    expect(t).toMatchObject({ custom: true, dueDate: '2027-02-01', assignee: 'both', strict: true })
    s = reducer(s, { type: 'editTask', key: 'custom_x', patch: { title: 'Book the ceilidh band', dueOverride: '2027-03-01' } })
    t = find(s, 'custom_x')
    expect(t).toMatchObject({ title: 'Book the ceilidh band', dueDate: '2027-03-01' })
    const record = s.tasks.find((x) => x.key === 'custom_x')!
    s = reducer(s, { type: 'removeTask', key: 'custom_x' })
    expect(s.tasks.some((x) => x.key === 'custom_x')).toBe(false)
    s = reducer(s, { type: 'restoreTask', task: record })
    expect(find(s, 'custom_x').title).toBe('Book the ceilidh band')
  })
  it('legacy custom tasks still load', () => {
    const s = plan()
    s.tasks = [{ id: 'old', key: 'custom_old', title: 'Old one', body: '', stage: 'details', dueDate: '', officialUrl: '', officialLabel: '', legal: false, custom: true, done: true }]
    expect(find(s, 'custom_old')).toMatchObject({ title: 'Old one', done: true })
  })
})

describe('filters and ordering', () => {
  const s0 = (() => {
    let s = plan(DATE, { datesFrom: '2026-11-11' })
    s = reducer(s, { type: 'editTask', key: 'book-venue', patch: { assignee: 'a' } })
    s = reducer(s, { type: 'editTask', key: 'book-photo', patch: { assignee: 'b' } })
    s = reducer(s, { type: 'editTask', key: 'book-music', patch: { assignee: 'both' } })
    s = reducer(s, { type: 'editTask', key: 'book-cake', patch: { hidden: true } })
    s = reducer(s, { type: 'setTaskDone', key: 'vision-budget', done: true })
    return s
  })()
  const tasks = mergeTasks(s0)
  const keys = (f: Parameters<typeof matchesFilter>[1], me: 'a' | 'b' = 'a') =>
    tasks.filter((t) => matchesFilter(t, f, me, '2026-11-11', '2026-11-11')).map((t) => t.key)
  it('Mine / Partner’s / Done / Hidden', () => {
    expect(keys('mine').sort()).toEqual(['book-music', 'book-venue'])
    expect(keys('partner').sort()).toEqual(['book-music', 'book-photo'])
    expect(keys('mine', 'b').sort()).toEqual(['book-music', 'book-photo'])
    expect(keys('done')).toContain('vision-budget')
    expect(keys('done').every((k) => tasks.find((t) => t.key === k)!.done)).toBe(true)
    expect(keys('hidden')).toEqual(['book-cake'])
    expect(keys('all')).not.toContain('book-cake')
  })
  it('groups by due date and keeps every visible task exactly once', () => {
    const vis = tasks.filter((t) => matchesFilter(t, 'all', 'a', '2026-11-11', '2026-11-11'))
    const groups = groupTasks(vis, '2026-11-11', '2026-11-11')
    expect(groups.flatMap((g) => g.tasks).length).toBe(vis.length)
    expect(groups.at(-1)?.group).toBe('done')
    for (const g of groups.filter((g) => g.group !== 'done')) {
      const dates = g.tasks.map((t) => t.dueDate)
      expect(dates).toEqual([...dates].sort())
    }
  })
  it('moves a task within its group without crossing dates elsewhere', () => {
    const list = sortTasks(tasks.filter((t) => t.dueDate === tasks.find((x) => x.key === 'book-venue')!.dueDate || t.stage === 'vision'), 'stage')
    const m = movePatch(list, 1, -1, 'stage')!
    let s = reducer(s0, { type: 'editTask', key: m.key, patch: m.patch })
    const after = sortTasks(mergeTasks(s).filter((t) => list.some((x) => x.key === t.key)), 'stage')
    expect(after[0].key).toBe(list[1].key)
    expect(after[1].key).toBe(list[0].key)
    expect(movePatch(list, 0, -1, 'stage')).toBeNull()
    // Date view: a moved task stays within its own day.
    const dated: PlanTask[] = sortTasks(mergeTasks(s).filter((t) => t.dueDate), 'date')
    const i = dated.findIndex((t, j) => j > 0 && dated[j - 1].dueDate === t.dueDate)
    if (i > 0) {
      const mv = movePatch(dated, i, -1, 'date')!
      s = reducer(s, { type: 'editTask', key: mv.key, patch: mv.patch })
      const re = sortTasks(mergeTasks(s).filter((t) => t.dueDate), 'date')
      expect(re[i - 1].key).toBe(dated[i].key)
      expect(re.map((t) => t.dueDate)).toEqual(dated.map((t) => t.dueDate))
    }
  })
})

function fakeTime(start = 1_000) {
  let t = start
  return { now: () => t, advance: (ms = 1000) => (t += ms) }
}
function device(name: string, start: SyncDoc, time: { now: () => number }) {
  const tick = makeClock(name, time.now)
  let doc: SyncDoc = structuredClone(start)
  return {
    get doc() {
      return doc
    },
    act(fn: (s: AppState) => AppState) {
      const next = fn(structuredClone(doc.state))
      const { meta } = stampChanges(doc.state, next, doc.meta, tick)
      doc = { state: next, meta }
    },
  }
}

describe('sync: task edits merge per field', () => {
  const pair = (setup?: (s: AppState) => AppState) => {
    const time = fakeTime()
    const a = device('a', { state: plan(DATE), meta: emptyMeta() }, time)
    if (setup) a.act(setup)
    time.advance()
    const b = device('b', a.doc, time)
    return { a, b, time }
  }
  it('two phones editing different fields of one task both stick', () => {
    const { a, b, time } = pair()
    a.act((s) => reducer(s, { type: 'editTask', key: 'book-venue', patch: { dueOverride: '2026-12-01' } }))
    time.advance()
    b.act((s) => reducer(s, { type: 'editTask', key: 'book-venue', patch: { assignee: 'b', notes: 'Sam calls' } }))
    const ab = mergeDocs(a.doc, b.doc, time.now())
    const ba = mergeDocs(b.doc, a.doc, time.now())
    expect(find(ab.state, 'book-venue')).toMatchObject({ dueDate: '2026-12-01', assignee: 'b', notes: 'Sam calls' })
    expect(docsEqual(ab, ba)).toBe(true)
  })
  it('a cleared field (unhide) beats an older set', () => {
    const { a, b, time } = pair((s) => reducer(s, { type: 'editTask', key: 'book-cake', patch: { hidden: true } }))
    time.advance()
    b.act((s) => reducer(s, { type: 'editTask', key: 'book-cake', patch: { hidden: undefined } }))
    time.advance()
    a.act((s) => reducer(s, { type: 'editTask', key: 'book-cake', patch: { notes: 'Ask Gran' } }))
    const m = mergeDocs(a.doc, b.doc, time.now())
    expect(find(m.state, 'book-cake')).toMatchObject({ notes: 'Ask Gran' })
    expect(find(m.state, 'book-cake').hidden).toBeUndefined()
  })
  it('a deleted custom task stays deleted on the other phone (tombstone); undo brings it back', () => {
    const add = (s: AppState) => reducer(s, { type: 'addCustomTask', title: 'Kilt hire', stage: 'details', key: 'custom_k' })
    const { a, b, time } = pair(add)
    const rec = a.doc.state.tasks.find((t) => t.key === 'custom_k') as Task
    a.act((s) => reducer(s, { type: 'removeTask', key: 'custom_k' }))
    let m = mergeDocs(b.doc, a.doc, time.now())
    expect(m.state.tasks.some((t) => t.key === 'custom_k')).toBe(false)
    time.advance()
    a.act((s) => reducer(s, { type: 'restoreTask', task: rec }))
    m = mergeDocs(b.doc, a.doc, time.now())
    expect(m.state.tasks.some((t) => t.key === 'custom_k')).toBe(true)
  })
  it('a removed built-in task merges as removed, and keeps the other phone’s tick', () => {
    const { a, b, time } = pair()
    a.act((s) => reducer(s, { type: 'removeTask', key: 'book-cake' }))
    time.advance()
    b.act((s) => reducer(s, { type: 'setTaskDone', key: 'book-venue', done: true }))
    const m = mergeDocs(a.doc, b.doc, time.now())
    expect(find(m.state, 'book-cake').removed).toBe(true)
    expect(find(m.state, 'book-venue').done).toBe(true)
  })
})
