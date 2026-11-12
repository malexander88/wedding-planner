import { planningNumbers } from '../data/guests'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BUDGET_CATEGORY_OPTIONS, budgetSummary, committedGroups, type CommittedItem } from '../data/budget'
import { formatShort } from '../data/legal'
import { uid } from '../lib/ids'
import { gbp } from '../lib/money'
import { useStore } from '../state/store'
import type { BudgetLine } from '../types'

export function Budget() {
  const { state, dispatch, tasks } = useStore()
  const sum = budgetSummary(state)
  const numbers = planningNumbers(state)
  const groups = committedGroups(state)
  const [adding, setAdding] = useState(false)
  const payments = [...state.payments].sort((a, b) => {
    if (!!a.paidDate !== !!b.paidDate) return a.paidDate ? 1 : -1
    return (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
  })
  const lineName = (id: string) => state.budgetLines.find((l) => l.id === id)?.name
  const taskTitle = (key?: string) => (key ? tasks.find((t) => t.key === key)?.title : undefined)

  const pct = Math.round(sum.ratio * 100)
  const circ = 2 * Math.PI * 52
  const dash = `${(Math.min(1, sum.ratio) * circ).toFixed(2)} ${circ.toFixed(2)}`

  return (
    <div className="grid">
      <header className="page-head">
        <div className="kicker">Money</div>
        <h1>Budget</h1>
        <p>One overall figure. It fills up as you book things and note prices in the Plan.</p>
      </header>

      <section className={`card budget-hero level-${sum.level}`}>
        <div className="budget-ring" role="img" aria-label={sum.total ? `${pct}% of your budget committed` : 'No total budget set'}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="track" cx="60" cy="60" r="52" />
            {sum.total > 0 && sum.committed > 0 && <circle className="fill" cx="60" cy="60" r="52" style={{ strokeDasharray: dash }} />}
          </svg>
          <div className="ring-label">
            <b>{sum.total ? `${pct}%` : '—'}</b>
            <span>{sum.total ? 'committed' : 'no total yet'}</span>
          </div>
        </div>
        <div className="budget-total">
          <label className="field" style={{ marginBottom: 6 }}>
            <span>Total budget (£)</span>
            <input
              id="total-budget"
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              placeholder="e.g. 18000"
              value={state.profile.totalBudget || ''}
              onChange={(e) => dispatch({ type: 'patchProfile', patch: { totalBudget: Math.max(0, Number(e.target.value) || 0) } })}
            />
          </label>
          {sum.level === 'over' && <div className="budget-flag over">Over budget by {gbp(sum.committed - sum.total)}</div>}
          {sum.level === 'amber' && <div className="budget-flag amber">Nearly there — {gbp(sum.left)} left</div>}
        </div>
        <dl className="budget-figures">
          <div><dt>Total budget</dt><dd>{sum.total ? gbp(sum.total) : 'Not set'}</dd></div>
          <div><dt>Committed</dt><dd>{gbp(sum.committed)}</dd></div>
          <div><dt>Paid so far</dt><dd>{gbp(sum.paid)}</dd></div>
          <div><dt>Still to pay</dt><dd>{gbp(sum.toPay)}</dd></div>
          {sum.total ? (
            <div className={`left ${sum.left < 0 ? 'neg' : ''}`}>
              <dt>Left to allocate</dt>
              <dd>{sum.left < 0 ? `−${gbp(-sum.left)}` : gbp(sum.left)}</dd>
            </div>
          ) : (
            <div className="left unset">
              <dt>Left to allocate</dt>
              <dd>
                <button className="text-btn" type="button" onClick={() => document.getElementById('total-budget')?.focus()}>
                  Set a budget
                </button>
              </dd>
              <p className="tiny" style={{ margin: '4px 0 0' }}>Add one total and we’ll show what’s left as you book things.</p>
            </div>
          )}
        </dl>
      </section>

      <section className="card">
        <div className="sec-head">
          <h2>Your costs</h2>
          <button className="btn ghost small" type="button" onClick={() => setAdding(true)}>
            Add a cost
          </button>
        </div>
        {adding && <AddCost onDone={() => setAdding(false)} />}
        {groups.length === 0 && !adding ? (
          <div className="empty budget-empty">
            <strong>Nothing committed yet</strong>
            <p>
              This fills up as you book things. Tick off a task in the <Link to="/plan">Plan</Link> and note the price, book a
              supplier from <Link to="/find">Find</Link>, or add a cost yourself.
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <div className="cost-group" key={g.category}>
              <div className="cost-group-head">
                <h3>{g.label}</h3>
                <span>{gbp(g.total)}</span>
              </div>
              {g.category === 'catering' && numbers.day > 0 && g.total > 0 && (
                <p className="tiny per-head">
                  About {gbp(Math.round(g.total / (numbers.day + numbers.evening)))} a head for {numbers.day} day
                  {numbers.evening ? ` + ${numbers.evening} evening` : ''} guests
                  {numbers.fromList ? ' on your guest list' : ' (your first guess — add guests for real numbers)'}.
                </p>
              )}
              {g.items.map((item) => (
                <CostItem key={item.line.id} item={item} taskTitle={taskTitle(item.line.taskKey)} />
              ))}
            </div>
          ))
        )}
      </section>

      <section className="card">
        <div className="sec-head">
          <h2>Payments</h2>
          {state.budgetLines.length > 0 && (
            <button
              className="btn ghost small"
              type="button"
              onClick={() =>
                dispatch({
                  type: 'addPayment',
                  payment: { id: uid('pay'), budgetLineId: state.budgetLines[0].id, kind: 'other', amount: 0, dueDate: '', paidDate: '', notes: 'Payment' },
                })
              }
            >
              Add a payment
            </button>
          )}
        </div>
        {payments.length === 0 ? (
          <div className="empty">No payments yet. Deposits and balances appear here when you note them on a booking.</div>
        ) : (
          <div className="list">
            {payments.map((p) => (
              <div key={p.id} className={`row pay-row${p.paidDate ? ' paid' : ''}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    aria-label="Payment name"
                    value={p.notes}
                    onChange={(e) => dispatch({ type: 'updatePayment', id: p.id, patch: { notes: e.target.value } })}
                  />
                  <div className="tiny">
                    <span style={{ textTransform: 'capitalize' }}>{p.kind}</span> · {gbp(p.amount)}
                    {p.paidDate ? ` · paid ${formatShort(p.paidDate)}` : p.dueDate ? ` · due ${formatShort(p.dueDate)}` : ''}
                    {taskTitle(p.taskKey) && (
                      <>
                        {' · '}
                        <Link to="/plan" className="linked">From Plan: {taskTitle(p.taskKey)}</Link>
                      </>
                    )}
                  </div>
                  <div className="grid-2" style={{ marginTop: 8 }}>
                    <label className="field">
                      <span>Amount (£)</span>
                      <input type="number" value={p.amount || ''} onChange={(e) => dispatch({ type: 'updatePayment', id: p.id, patch: { amount: Number(e.target.value) } })} />
                    </label>
                    <label className="field">
                      <span>Due</span>
                      <input type="date" value={p.dueDate} onChange={(e) => dispatch({ type: 'updatePayment', id: p.id, patch: { dueDate: e.target.value } })} />
                    </label>
                    {state.budgetLines.length > 1 && !p.taskKey && (
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span>For</span>
                        <select value={p.budgetLineId} onChange={(e) => dispatch({ type: 'updatePayment', id: p.id, patch: { budgetLineId: e.target.value } })}>
                          {!lineName(p.budgetLineId) && <option value={p.budgetLineId}>Choose…</option>}
                          {state.budgetLines.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
                <div className="pay-actions">
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={Boolean(p.paidDate)}
                      onChange={(e) =>
                        dispatch({ type: 'updatePayment', id: p.id, patch: { paidDate: e.target.checked ? new Date().toISOString().slice(0, 10) : '' } })
                      }
                    />
                    Paid
                  </label>
                  {!p.taskKey && (
                    <button className="text-btn danger" type="button" onClick={() => dispatch({ type: 'removePayment', id: p.id })}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function CostItem({ item, taskTitle }: { item: CommittedItem; taskTitle?: string }) {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const { line } = item
  const update = (patch: Partial<BudgetLine>) => dispatch({ type: 'upsertBudgetLine', line: { ...line, ...patch } })
  const supplier = line.supplierId ? state.suppliers.find((s) => s.id === line.supplierId) : undefined
  return (
    <div className="cost-item">
      <button type="button" className="cost-main" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="cost-copy">
          <strong>{line.name}</strong>
          <span>
            {item.cost ? `${gbp(item.paid)} paid` : 'Price not noted yet'}
            {item.nextDue ? ` · next ${gbp(item.nextDue.amount)}${item.nextDue.dueDate ? ` due ${formatShort(item.nextDue.dueDate)}` : ''}` : item.cost && item.paid >= item.cost ? ' · all paid' : ''}
          </span>
        </div>
        <span className="cost-amt">{gbp(item.cost)}</span>
      </button>
      {open && (
        <div className="cost-edit">
          <div className="grid-2">
            <label className="field">
              <span>Name</span>
              <input value={line.name} onChange={(e) => update({ name: e.target.value })} />
            </label>
            <label className="field">
              <span>Agreed price (£)</span>
              <input type="number" min={0} value={line.quoted || ''} onChange={(e) => update({ quoted: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            <label className="field">
              <span>Category</span>
              <select value={line.category} onChange={(e) => update({ category: e.target.value as BudgetLine['category'] })}>
                {BUDGET_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="btn-row">
            {taskTitle && <Link className="linked" to="/plan">From Plan: {taskTitle}</Link>}
            {supplier && <Link className="linked" to={`/find/${supplier.id}`}>Booked in Find: {supplier.name}</Link>}
            <button
              className="text-btn danger"
              type="button"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                if (window.confirm(`Remove ${line.name} and its payments from the budget?`)) dispatch({ type: 'removeBudgetLine', id: line.id })
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddCost({ onDone }: { onDone: () => void }) {
  const { dispatch } = useStore()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState<BudgetLine['category']>('other')
  const [paid, setPaid] = useState(false)
  const save = () => {
    const amount = Math.max(0, Number(price.replace(/[£,\s]/g, '')) || 0)
    if (!name.trim() || !amount) return
    const id = uid('bl')
    dispatch({ type: 'upsertBudgetLine', line: { id, category, name: name.trim(), estimate: 0, quoted: amount, actual: 0, vatIncluded: true, notes: '' } })
    if (paid) {
      dispatch({
        type: 'addPayment',
        payment: { id: uid('pay'), budgetLineId: id, kind: 'other', amount, dueDate: '', paidDate: new Date().toISOString().slice(0, 10), notes: name.trim() },
      })
    }
    onDone()
  }
  return (
    <div className="add-cost">
      <div className="grid-2">
        <label className="field">
          <span>What for</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wedding favours" />
        </label>
        <label className="field">
          <span>Price (£)</span>
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as BudgetLine['category'])}>
            {BUDGET_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="inline" style={{ alignSelf: 'end', paddingBottom: 22 }}>
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          Already paid
        </label>
      </div>
      <div className="btn-row">
        <button className="btn" type="button" onClick={save} disabled={!name.trim() || !price.trim()}>
          Add cost
        </button>
        <button className="btn ghost" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}
