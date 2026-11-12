// What happens when task details are saved: link or create the supplier,
// feed Budget (one line per task/supplier, deterministic ids so two phones
// agree), create or update payments, and apply profile decisions.
// Plus the Northern Ireland date checks and Home reminders. All pure.

import type { AppState, BudgetLine, Payment, PlanTask, Supplier, SupplierCategory, Task, TaskDetail } from '../types'
import { catchUpBefore, isCatchUp } from './plan'
import { guestCounts, planningNumbers } from './guests'
import { addDays, formatShort, noticeDueDate, noticeMinimumDate, scheduleFromDate, scheduleReturnDate } from './legal'
import { allFields, budgetCategory, money, templateFor, TEMPLATES, type TemplateDef } from './taskTemplates'

export const detailIdFor = (taskKey: string) => `td_${taskKey}`

export function findDetail(state: Pick<AppState, 'taskDetails'>, taskKey: string): TaskDetail | undefined {
  return (state.taskDetails ?? []).find((d) => d.taskKey === taskKey)
}

/** Starting values for a task with no details yet: presets plus what we already know. */
export function initialValues(task: Task, state: AppState): { values: Record<string, string>; supplierId?: string } {
  const { template, preset } = templateFor(task)
  const values: Record<string, string> = { ...preset }
  const p = state.profile
  let supplierId: string | undefined

  if (template.id === 'booking') {
    const cat = (values.category || 'venue') as SupplierCategory
    const booked =
      (cat === 'venue' && p.venueSupplierId && state.suppliers.find((s) => s.id === p.venueSupplierId)) ||
      state.suppliers.find((s) => s.category === cat && s.status === 'booked')
    if (booked) {
      supplierId = booked.id
      Object.assign(values, supplierValues(booked))
      const line = state.budgetLines.find((l) => l.supplierId === booked.id)
      if (line?.quoted) values.total = String(line.quoted)
      const dep = state.payments.find((x) => x.supplierId === booked.id && x.kind === 'deposit')
      if (dep) {
        values.deposit = String(dep.amount || '')
        if (dep.paidDate) values.depositPaidDate = dep.paidDate
      }
      const bal = state.payments.find((x) => x.supplierId === booked.id && x.kind === 'balance')
      if (bal?.dueDate) values.balanceDue = bal.dueDate
      if (bal?.paidDate) values.balancePaid = 'true'
    }
  }
  if (template.id === 'vision') {
    values.workingBudget = String(p.totalBudget || '')
    values.dayGuests = String(p.estimatedDayGuests || '')
    values.eveningGuests = String(p.estimatedEveningGuests || '')
  }
  if (template.id === 'decision' && p.date) {
    values.chosenDate = p.date
  }
  if ((template.id === 'legal-notice' || template.id === 'legal-officiant') && p.ceremonyType !== 'undecided') {
    values.ceremonyType = p.ceremonyType
  }
  if (template.id === 'legal-notice') {
    values.fee = '44'
    const appt = findDetail(state, 'legal-book-appointment')
    if (appt?.values.office) values.office = appt.values.office
  }
  if (template.id === 'guests') {
    // Counts from the guest list: people for catering numbers, households for stationery.
    const c = guestCounts(state)
    const n = planningNumbers(state)
    const count = task.key === 'people-final-numbers' || task.key === 'people-dietary' ? n.day + n.evening : c.invitesSent + c.invitesToSend
    if (count) values.count = String(count)
  }
  return { values, supplierId }
}

export function supplierValues(s: Supplier): Record<string, string> {
  return {
    supplierName: s.name,
    ...(s.phone ? { phone: s.phone } : {}),
    ...(s.email ? { email: s.email } : {}),
    ...(s.website ? { website: s.website } : {}),
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Apply a saved detail to the rest of the plan. Deterministic ids keep both phones in step. */
export function applyTaskDetail(state: AppState, input: TaskDetail, now = today()): AppState {
  const task = { key: input.taskKey, template: input.template, legal: false }
  const template: TemplateDef = TEMPLATES[input.template] ?? templateFor(task).template
  const values = { ...input.values }
  let detail: TaskDetail = { ...input, values }
  let suppliers = state.suppliers
  let profile = state.profile

  // 1. Supplier link / create (bookings)
  if (template.id === 'booking') {
    const category = (values.category || 'other') as SupplierCategory
    const name = (values.supplierName || '').trim()
    let sup = detail.supplierId ? suppliers.find((s) => s.id === detail.supplierId) : undefined
    if (!sup && name) {
      sup = suppliers.find((s) => s.name.trim().toLowerCase() === name.toLowerCase() && s.category === category)
    }
    if (!sup && name) {
      sup = {
        id: `sup_task_${input.taskKey}`,
        name,
        category,
        area: profile.area,
        website: values.website || '',
        phone: values.phone || '',
        email: values.email || '',
        status: 'booked',
        notes: '',
        addedAt: new Date().toISOString(),
      }
      suppliers = [...suppliers, sup]
    } else if (sup) {
      const patch: Partial<Supplier> = { status: 'booked' }
      if (name && name !== sup.name) patch.name = name
      if (values.phone && !sup.phone) patch.phone = values.phone
      if (values.email && !sup.email) patch.email = values.email
      if (values.website && !sup.website) patch.website = values.website
      const updated = { ...sup, ...patch }
      suppliers = suppliers.map((s) => (s.id === updated.id ? updated : s))
      sup = updated
    }
    if (sup) {
      detail = { ...detail, supplierId: sup.id, values: { ...values, supplierName: sup.name } }
      if (category === 'venue') profile = { ...profile, venueSupplierId: sup.id }
    }
  }

  // 2. Profile decisions
  if (template.id === 'vision') {
    const patch: Partial<typeof profile> = {}
    if (money(values.workingBudget)) patch.totalBudget = money(values.workingBudget)
    if (Number(values.dayGuests) > 0) patch.estimatedDayGuests = Number(values.dayGuests)
    if (values.eveningGuests !== undefined && values.eveningGuests !== '' && Number(values.eveningGuests) >= 0) {
      patch.estimatedEveningGuests = Number(values.eveningGuests)
    }
    profile = { ...profile, ...patch }
  }
  if (template.id === 'decision' && values.useAsDate === 'true' && /^\d{4}-\d{2}-\d{2}$/.test(values.chosenDate || '')) {
    const d = values.chosenDate
    profile = {
      ...profile,
      date: d,
      candidateDates: profile.candidateDates.includes(d) ? profile.candidateDates : [...profile.candidateDates, d].sort(),
    }
  }
  if ((template.id === 'legal-notice' || template.id === 'legal-officiant') && values.ceremonyType) {
    profile = { ...profile, ceremonyType: values.ceremonyType as typeof profile.ceremonyType }
  }

  // 3. Budget line + payments
  let budgetLines = state.budgetLines
  let payments = state.payments
  const m = template.money
  const total = m ? money(values[m.total]) : 0
  if (m && total > 0) {
    const category = budgetCategory(template, values)
    const supplierId = detail.supplierId
    const label =
      (m.payee && values[m.payee]) || values.supplierName || values.item || values.provider || template.label

    let line =
      (detail.budgetLineId && budgetLines.find((l) => l.id === detail.budgetLineId)) ||
      budgetLines.find((l) => l.taskKey === input.taskKey) ||
      (supplierId ? budgetLines.find((l) => l.supplierId === supplierId) : undefined)
    if (line) {
      const updated: BudgetLine = {
        ...line,
        quoted: total,
        taskKey: input.taskKey,
        ...(supplierId ? { supplierId, name: label } : {}),
      }
      budgetLines = budgetLines.map((l) => (l.id === updated.id ? updated : l))
      line = updated
    } else {
      line = {
        id: `bl_task_${input.taskKey}`,
        category,
        name: label,
        estimate: 0,
        quoted: total,
        actual: 0,
        vatIncluded: true,
        supplierId,
        taskKey: input.taskKey,
        notes: '',
      }
      budgetLines = [...budgetLines, line]
    }
    detail = { ...detail, budgetLineId: line.id }

    const deposit = m.deposit ? Math.min(money(values[m.deposit]), total) : 0
    const rest = Math.max(0, Math.round((total - deposit) * 100) / 100)
    const paidAll = !!(m.paidFlag && values[m.paidFlag] === 'true')
    const lineId = line.id

    const existing = (kind: Payment['kind']) =>
      payments.find((x) => x.taskKey === input.taskKey && x.kind === kind) ||
      (supplierId ? payments.find((x) => x.supplierId === supplierId && x.kind === kind && !x.taskKey) : undefined)

    const upsert = (kind: Payment['kind'], amount: number, dueDate: string, paidDate: string, note: string) => {
      const prev = existing(kind)
      if (amount <= 0) {
        if (prev && prev.taskKey === input.taskKey) payments = payments.filter((x) => x.id !== prev.id)
        return
      }
      const next: Payment = {
        id: prev?.id ?? `pay_task_${input.taskKey}_${kind}`,
        budgetLineId: lineId,
        supplierId,
        kind,
        amount,
        dueDate,
        paidDate,
        notes: prev?.notes && prev.taskKey === input.taskKey ? prev.notes : note,
        taskKey: input.taskKey,
      }
      payments = prev ? payments.map((x) => (x.id === prev.id ? next : x)) : [...payments, next]
    }

    if (m.deposit) {
      const depPaid = (m.depositPaid && values[m.depositPaid]) || ''
      const prevDep = existing('deposit')
      upsert('deposit', deposit, depPaid || prevDep?.dueDate || '', depPaid || (paidAll ? prevDep?.paidDate || now : ''), `Deposit — ${label}`)
      const prevBal = existing('balance')
      upsert(
        'balance',
        rest,
        (m.due && values[m.due]) || prevBal?.dueDate || '',
        paidAll ? prevBal?.paidDate || now : '',
        `Balance — ${label}`,
      )
    } else {
      const prev = existing('other')
      upsert('other', total, (m.due && values[m.due]) || prev?.dueDate || '', paidAll ? prev?.paidDate || now : '', label)
    }
  }

  const stamped = { ...detail, updatedAt: new Date().toISOString() }
  const others = (state.taskDetails ?? []).filter((d) => d.id !== stamped.id && d.taskKey !== stamped.taskKey)
  return { ...state, suppliers, profile, budgetLines, payments, taskDetails: [...others, stamped] }
}

// ---- Northern Ireland date checks ---------------------------------------

export interface Warning {
  level: 'error' | 'warn' | 'ok' | 'info'
  text: string
}

export function legalWarnings(templateId: string, values: Record<string, string>, state: Pick<AppState, 'profile'>): Warning[] {
  const p = state.profile
  const date = p.date
  const out: Warning[] = []
  const religious = (values.ceremonyType || p.ceremonyType) === 'religious' || (values.ceremonyType || p.ceremonyType) === 'humanist'
  const needsDate = ['legal-notice', 'legal-appointment', 'legal-schedule'].includes(templateId)
  if (needsDate && !date) {
    out.push({ level: 'info', text: 'Set your wedding date to check these dates against the Northern Ireland rules.' })
    return out
  }

  const checkNotice = (iso: string | undefined, what: string) => {
    if (!iso || !date) return
    const rec = noticeDueDate(date, p.previouslyMarried)
    const min = noticeMinimumDate(date)
    const earliest = addDays(date, -365)
    if (iso < earliest) out.push({ level: 'error', text: `${what} is more than 12 months before the wedding — notice can only be given in the 12 months before.` })
    else if (iso > min) out.push({ level: 'error', text: `${what} is less than 28 days before the wedding (${formatShort(min)} is the last possible day). The ceremony could not go ahead.` })
    else if (iso > rec) out.push({ level: 'warn', text: `${what} is later than the recommended ${p.previouslyMarried ? '10' : '8'} weeks (${formatShort(rec)}). It’s still legal, but leaves little room if anything needs checking.` })
    else out.push({ level: 'ok', text: `${what} fits the rules: at least ${p.previouslyMarried ? '10' : '8'} weeks before, within 12 months.` })
  }

  if (templateId === 'legal-notice') checkNotice(values.noticeDate, 'Notice')
  if (templateId === 'legal-appointment') checkNotice(values.appointmentDate, 'This appointment')

  if (templateId === 'legal-schedule' && date) {
    const from = scheduleFromDate(date)
    const ret = scheduleReturnDate(date)
    if (values.collectionDate) {
      if (values.collectionDate < from) out.push({ level: 'error', text: `The schedule can’t be issued more than 14 days before the wedding — earliest is ${formatShort(from)}.` })
      else if (values.collectionDate > date) out.push({ level: 'error', text: 'Collection is after the wedding — you need the schedule on the day.' })
      else out.push({ level: 'ok', text: 'Collection date is within the 14 days before the wedding.' })
    }
    if (values.collectedBy === 'Registrar brings it' && religious) {
      out.push({ level: 'warn', text: 'For a religious or humanist ceremony one of you must collect the schedule yourselves.' })
    }
    if (religious && values.returnDate) {
      if (values.returnDate > ret) out.push({ level: 'error', text: `It must be returned within 3 days of the ceremony (by ${formatShort(ret)}).` })
      else if (values.returnDate < date) out.push({ level: 'warn', text: 'The return date is before the wedding day.' })
      else out.push({ level: 'ok', text: 'Returned within 3 days.' })
    }
  }

  if (templateId === 'legal-witnesses') {
    const named = [values.witness1, values.witness2].filter((v) => v && v.trim()).length
    if (named < 2) out.push({ level: 'warn', text: 'You need two witnesses, each aged 16 or over.' })
    else if (values.over16 !== 'true') out.push({ level: 'warn', text: 'Confirm both witnesses are 16 or over.' })
  }
  if (templateId === 'legal-officiant' && religious && values.officiantName && values.registered !== 'true') {
    out.push({ level: 'warn', text: 'A religious or humanist officiant must be registered with the Registrar General — worth asking.' })
  }
  return out
}

// ---- Home reminders ---------------------------------------------------

export interface Reminder {
  id: string
  date: string
  title: string
  sub: string
  kind: 'payment' | 'date' | 'task'
  legal?: boolean
  amount?: number
  overdue: boolean
}

export function reminders(state: AppState, tasks: PlanTask[], from = today(), horizonDays = 120): Reminder[] {
  const until = addDays(from, horizonDays)
  const out: Reminder[] = []
  for (const pay of state.payments) {
    if (pay.paidDate || !pay.dueDate || !(pay.amount > 0)) continue
    if (pay.dueDate > until) continue
    const line = state.budgetLines.find((l) => l.id === pay.budgetLineId)
    out.push({
      id: `p_${pay.id}`,
      date: pay.dueDate,
      title: pay.notes || line?.name || 'Payment',
      sub: pay.kind === 'deposit' ? 'Deposit' : pay.kind === 'balance' ? 'Balance' : 'Payment',
      kind: 'payment',
      amount: pay.amount,
      overdue: pay.dueDate < from,
    })
  }
  for (const d of state.taskDetails ?? []) {
    const task = tasks.find((t) => t.key === d.taskKey)
    const t = TEMPLATES[d.template]
    if (!t) continue
    for (const f of allFields(t)) {
      if (!f.remind) continue
      const v = d.values[f.k]
      if (!v || v < from || v > until) continue
      if (t.money?.due === f.k) continue // already shown as a payment
      out.push({
        id: `d_${d.id}_${f.k}`,
        date: v,
        title: f.label.replace(/ \(.*\)$/, ''),
        sub: task?.title ?? t.label,
        kind: 'date',
        overdue: false,
      })
    }
  }
  const before = catchUpBefore(state.profile)
  for (const task of tasks) {
    if (task.done || !task.dueDate || task.dueDate > until || task.hidden || task.removed) continue
    // The full dated checklist lives on Plan (and Home's "Next deadlines"); here only the hard dates:
    // legal steps and dates the couple set or already had. Catch-up items are never "coming up".
    if (!task.legal && !task.strict && !task.dueOverride && task.graceBefore === undefined) continue
    if (isCatchUp(task, from, before)) continue
    out.push({
      id: `t_${task.key}`,
      date: task.dueDate,
      title: task.title,
      sub: task.legal ? 'Legal deadline' : 'Plan',
      kind: 'task',
      legal: task.legal,
      overdue: task.dueDate < from,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** Home's 'Coming up': everything in the next 90 days, and never fewer than the next five things. */
export function comingUp(all: Reminder[], from = today(), windowDays = 90, atLeast = 5): Reminder[] {
  const until = addDays(from, windowDays)
  const within = all.filter((r) => r.date <= until).length
  return all.slice(0, Math.max(atLeast, within))
}

/** Payment words from the real payments (so ticking "Paid" in Budget shows on the task). */
export function paymentStateFromPayments(state: Pick<AppState, 'payments'>, taskKey: string): string | undefined {
  const pays = state.payments.filter((p) => p.taskKey === taskKey && p.amount > 0)
  if (!pays.length) return undefined
  const unpaid = pays.filter((p) => !p.paidDate)
  if (!unpaid.length) return pays.length > 1 ? 'paid in full' : 'paid'
  const dep = pays.find((p) => p.kind === 'deposit')
  if (dep && !dep.paidDate) return 'deposit due'
  const next = unpaid.filter((p) => p.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  if (dep) return next ? `deposit paid · balance due ${formatShort(next.dueDate)}` : 'deposit paid'
  return next ? `due ${formatShort(next.dueDate)}` : 'to pay'
}
