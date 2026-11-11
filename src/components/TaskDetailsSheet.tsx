import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { applyTaskDetail, detailIdFor, findDetail, initialValues, legalWarnings, paymentStateFromPayments, supplierValues } from '../data/taskDetails'
import {
  budgetCategory,
  CUSTOM_TEMPLATE_CHOICES,
  fmtGbp,
  money,
  summaryLine,
  TEMPLATES,
  templateFor,
  type FieldDef,
  type TemplateDef,
} from '../data/taskTemplates'
import { formatShort } from '../data/legal'
import { useStore } from '../state/store'
import type { SupplierCategory, Task, TaskDetail, TemplateId } from '../types'

export type SheetMode = 'tick' | 'edit'

const CATEGORY_WORDS: Record<string, string> = {
  venue: 'Venue',
  catering: 'Catering',
  photographer: 'Photography',
  videographer: 'Video',
  attire: 'Attire',
  florist: 'Flowers',
  entertainment: 'Entertainment',
  decor: 'Decor',
  cake: 'Cake',
  stationery: 'Stationery',
  transport: 'Transport',
  legal: 'Legal',
  insurance: 'Insurance',
  officiant: 'Officiant',
  hair: 'Hair',
  makeup: 'Make-up',
  planner: 'Planner',
  other: 'Other',
}

/** Open/close plumbing shared by Plan and Home. */
export function useTaskSheet() {
  const [open, setOpen] = useState<{ task: Task; mode: SheetMode } | null>(null)
  const element = open ? (
    <TaskDetailsSheet key={open.task.key + open.mode} task={open.task} mode={open.mode} onClose={() => setOpen(null)} />
  ) : null
  return { openSheet: (task: Task, mode: SheetMode) => setOpen({ task, mode }), sheet: element }
}

/** Compact summary for a task with saved details, or null. */
export function useDetailSummary() {
  const { state } = useStore()
  return (task: Task): string | null => {
    const d = findDetail(state, task.key)
    if (!d) return null
    const t = TEMPLATES[d.template] ?? templateFor(task).template
    return summaryLine(t, d.values, paymentStateFromPayments(state, task.key)) || null
  }
}

export function TaskDetailsSheet({ task, mode, onClose }: { task: Task; mode: SheetMode; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const existing = findDetail(state, task.key)
  const initial = useMemo(() => {
    if (existing) return { values: { ...existing.values }, supplierId: existing.supplierId, template: existing.template }
    const { template } = templateFor(task)
    const init = initialValues(task, state)
    return { ...init, template: template.id }
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [templateId, setTemplateId] = useState<TemplateId>(initial.template)
  const [values, setValues] = useState<Record<string, string>>(initial.values)
  const [supplierId, setSupplierId] = useState<string | undefined>(initial.supplierId)
  const [dirty, setDirty] = useState(false)
  const template: TemplateDef = TEMPLATES[templateId] ?? TEMPLATES.generic
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const set = (k: string, v: string) => {
    setValues((old) => ({ ...old, [k]: v }))
    setDirty(true)
  }
  const ctx = { values, profile: state.profile }
  const warnings = template.legal ? legalWarnings(template.id, values, state) : []

  const detail = (): TaskDetail => ({
    id: existing?.id ?? detailIdFor(task.key),
    taskKey: task.key,
    template: template.id,
    values: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)),
    ...(supplierId ? { supplierId } : {}),
    ...(existing?.budgetLineId ? { budgetLineId: existing.budgetLineId } : {}),
    updatedAt: '',
  })

  // Preview what Budget will show.
  const preview = useMemo(() => {
    const m = template.money
    if (!m || !money(values[m.total])) return null
    const next = applyTaskDetail(state, detail())
    const pays = next.payments.filter((p) => p.taskKey === task.key)
    const cat = budgetCategory(template, values)
    return { total: money(values[m.total]), cat: CATEGORY_WORDS[cat] ?? cat, pays }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, templateId, supplierId, state])

  const save = (markDone: boolean) => {
    if (dirty || (existing && templateId !== existing.template)) {
      dispatch({ type: 'saveTaskDetail', detail: detail(), markDone })
    } else if (markDone) {
      dispatch({ type: 'setTaskDone', key: task.key, done: true })
    }
    onClose()
  }

  const firstOpen = (i: number, fields: FieldDef[]) => i <= 1 || fields.some((f) => values[f.k] && f.type !== 'select')

  return (
    <div className="modal-back sheet-back" onClick={onClose}>
      <div
        className="modal sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="td-title"
        tabIndex={-1}
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <div style={{ minWidth: 0 }}>
            <div className="kicker">{mode === 'tick' ? 'Marking done' : 'Details'} · {template.label}</div>
            <h2 id="td-title">{task.title}</h2>
            <p className="tiny" style={{ margin: 0 }}>
              {mode === 'tick' ? `${template.blurb} Everything is optional — skip and add it later.` : template.blurb}
            </p>
          </div>
          <button type="button" className="icon-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {task.custom && (
          <label className="field">
            <span>What kind of task is this?</span>
            <select
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value as TemplateId)
                setDirty(true)
              }}
            >
              {CUSTOM_TEMPLATE_CHOICES.map((id) => (
                <option key={id} value={id}>
                  {TEMPLATES[id].label}
                </option>
              ))}
            </select>
          </label>
        )}

        {warnings.length > 0 && (
          <div className="td-warnings" aria-live="polite">
            {warnings.map((w, i) => (
              <div key={i} className={`td-warn ${w.level}`}>
                {w.text}
              </div>
            ))}
          </div>
        )}

        {template.sections.map((sec, i) => {
          const visible = sec.fields.filter((f) => !f.when || f.when(ctx))
          if (!visible.length) return null
          return (
            <details className="fold" key={`${templateId}-${sec.title}`} open={firstOpen(i, visible)}>
              <summary>{sec.title}</summary>
              <div className="td-grid">
                {visible.map((f) => (
                  <Field
                    key={f.k}
                    f={f}
                    value={values[f.k] ?? ''}
                    onChange={(v) => set(f.k, v)}
                    supplierPicker={
                      f.type === 'supplier' ? (
                        <SupplierPicker
                          category={(values.category || 'other') as SupplierCategory}
                          supplierId={supplierId}
                          name={values.supplierName ?? ''}
                          onPick={(id) => {
                            setSupplierId(id)
                            setDirty(true)
                            const s = state.suppliers.find((x) => x.id === id)
                            if (s) setValues((old) => ({ ...supplierValues(s), ...stripEmpty(old), supplierName: s.name }))
                          }}
                          onName={(name) => {
                            setValues((old) => ({ ...old, supplierName: name }))
                            setDirty(true)
                          }}
                        />
                      ) : null
                    }
                  />
                ))}
              </div>
            </details>
          )
        })}


        {preview && (
          <div className="td-budget">
            <strong>
              {fmtGbp(preview.total)} goes into Budget · {preview.cat}
            </strong>
            <ul>
              {preview.pays.map((p) => (
                <li key={p.id}>
                  {p.kind === 'deposit' ? 'Deposit' : p.kind === 'balance' ? 'Balance' : 'Payment'} {fmtGbp(p.amount)}
                  {p.paidDate ? ` · paid ${formatShort(p.paidDate)}` : p.dueDate ? ` · due ${formatShort(p.dueDate)}` : ' · no due date yet'}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="sheet-actions">
          {mode === 'tick' ? (
            <>
              <button className="btn" type="button" onClick={() => save(true)}>
                Mark done
              </button>
              <button className="btn ghost" type="button" onClick={() => {
                dispatch({ type: 'setTaskDone', key: task.key, done: true })
                onClose()
              }}>
                Skip details
              </button>
            </>
          ) : (
            <>
              <button className="btn" type="button" onClick={() => save(false)}>
                Save details
              </button>
              <button className="btn ghost" type="button" onClick={onClose}>
                Cancel
              </button>
              {existing && (
                <button
                  className="text-btn danger"
                  type="button"
                  onClick={() => {
                    if (window.confirm('Clear these details? Anything already in Budget stays there.')) {
                      dispatch({ type: 'removeTaskDetail', taskKey: task.key })
                      onClose()
                    }
                  }}
                >
                  Clear details
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function stripEmpty(v: Record<string, string>) {
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== ''))
}

function Field({
  f,
  value,
  onChange,
  supplierPicker,
}: {
  f: FieldDef
  value: string
  onChange: (v: string) => void
  supplierPicker: ReactNode
}) {
  const cls = `field${f.half ? ' half' : ''}`
  if (f.type === 'supplier') return <div className="field full">{supplierPicker}{f.hint && <small className="tiny">{f.hint}</small>}</div>
  if (f.type === 'check') {
    return (
      <label className={`inline td-check${f.half ? ' half' : ' full'}`}>
        <input type="checkbox" checked={value === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : '')} />
        <span>{f.label}</span>
      </label>
    )
  }
  const common = { value, placeholder: f.placeholder, onChange: (e: { target: { value: string } }) => onChange(e.target.value) }
  let input: ReactNode
  switch (f.type) {
    case 'textarea':
      input = <textarea className="autogrow" rows={2} {...common} />
      break
    case 'select':
      input = (
        <select {...common}>
          <option value="">Choose…</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
      break
    case 'money':
      input = <input type="text" inputMode="decimal" autoComplete="off" {...common} placeholder={f.placeholder ?? '0'} />
      break
    case 'number':
      input = <input type="number" inputMode="numeric" min={0} {...common} />
      break
    default:
      input = <input type={f.type} {...common} />
  }
  return (
    <label className={f.type === 'textarea' ? 'field full' : cls + (f.half ? '' : ' full')}>
      <span>{f.label}</span>
      {input}
      {f.hint && <small className="tiny">{f.hint}</small>}
    </label>
  )
}

function SupplierPicker({
  category,
  supplierId,
  name,
  onPick,
  onName,
}: {
  category: SupplierCategory
  supplierId?: string
  name: string
  onPick: (id: string | undefined) => void
  onName: (name: string) => void
}) {
  const { state } = useStore()
  const options = state.suppliers.filter((s) => s.category === category || s.id === supplierId)
  return (
    <>
      {options.length > 0 && (
        <label className="field" style={{ marginBottom: 8 }}>
          <span>From your Find shortlist</span>
          <select value={supplierId ?? ''} onChange={(e) => onPick(e.target.value || undefined)}>
            <option value="">Someone new…</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.status === 'booked' ? ' (booked)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field" style={{ marginBottom: 0 }}>
        <span>Supplier name</span>
        <input value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Belfast City Hall" />
      </label>
    </>
  )
}
