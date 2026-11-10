import { totals } from '../data/budgetSeeds'
import { categoryLabel } from '../data/categories'
import { formatShort } from '../data/legal'
import { uid } from '../lib/ids'
import { gbp } from '../lib/money'
import { useStore } from '../state/store'
import type { BudgetLine } from '../types'

export function Budget() {
  const { state, dispatch } = useStore()
  const money = totals(state)
  const upcoming = [...state.payments].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))

  const update = (line: BudgetLine, patch: Partial<BudgetLine>) =>
    dispatch({ type: 'upsertBudgetLine', line: { ...line, ...patch } })

  return (
    <div className="grid">
      <section className="card hero">
        <div className="kicker">Money</div>
        <h1>Budget and payments</h1>
        <p>
          Working budget {gbp(state.profile.totalBudget)}. Estimated {gbp(money.estimate)}, quoted {gbp(money.quoted)},
          actually spent {gbp(money.actual)}. Paid so far {gbp(money.paid)}; still marked as due {gbp(money.due)}.
        </p>
        <div className="progress">
          <div style={{ width: `${Math.min(100, (money.quoted / Math.max(state.profile.totalBudget, 1)) * 100)}%` }} />
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ paddingTop: 0 }}>
          <h2>Lines</h2>
          <button
            className="btn ghost small"
            type="button"
            onClick={() =>
              dispatch({
                type: 'upsertBudgetLine',
                line: {
                  id: uid('bl'),
                  category: 'other',
                  name: 'New line',
                  estimate: 0,
                  quoted: 0,
                  actual: 0,
                  vatIncluded: true,
                  notes: '',
                },
              })
            }
          >
            Add a line
          </button>
        </div>
        <div className="compare-list">
          {state.budgetLines.map((line) => (
            <article key={line.id} className="compare-card">
              <label className="field">
                <span>Name</span>
                <input value={line.name} onChange={(e) => update(line, { name: e.target.value })} />
                <div className="tiny">{categoryLabel(line.category)}</div>
              </label>
              <div className="money-grid">
                <label className="field">
                  <span>Estimate</span>
                  <input type="number" value={line.estimate || ''} onChange={(e) => update(line, { estimate: Number(e.target.value) })} />
                </label>
                <label className="field">
                  <span>Quoted</span>
                  <input type="number" value={line.quoted || ''} onChange={(e) => update(line, { quoted: Number(e.target.value) })} />
                </label>
                <label className="field">
                  <span>Actual</span>
                  <input type="number" value={line.actual || ''} onChange={(e) => update(line, { actual: Number(e.target.value) })} />
                </label>
              </div>
              <div className="row" style={{ paddingBottom: 0 }}>
                <label className="inline">
                  <input type="checkbox" checked={line.vatIncluded} onChange={(e) => update(line, { vatIncluded: e.target.checked })} />
                  Includes VAT
                </label>
                <button className="btn ghost small" type="button" onClick={() => dispatch({ type: 'removeBudgetLine', id: line.id })}>
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ paddingTop: 0 }}>
          <h2>Payment calendar</h2>
          <button
            className="btn ghost small"
            type="button"
            onClick={() =>
              dispatch({
                type: 'addPayment',
                payment: {
                  id: uid('pay'),
                  budgetLineId: state.budgetLines[0]?.id ?? '',
                  kind: 'other',
                  amount: 0,
                  dueDate: '',
                  paidDate: '',
                  notes: 'Payment',
                },
              })
            }
          >
            Add a payment
          </button>
        </div>
        {upcoming.length === 0 ? (
          <div className="empty">No payments yet. Booking a supplier will add a deposit and a balance here.</div>
        ) : (
          <div className="list">
            {upcoming.map((p) => (
              <div key={p.id} className="row">
                <div style={{ flex: 1 }}>
                  <input
                    value={p.notes}
                    onChange={(e) => dispatch({ type: 'updatePayment', id: p.id, patch: { notes: e.target.value } })}
                  />
                  <div className="tiny">{p.kind} · {gbp(p.amount)} {p.dueDate && `· due ${formatShort(p.dueDate)}`}</div>
                  <div className="grid-2" style={{ marginTop: 8 }}>
                    <label className="field">
                      <span>Amount</span>
                      <input type="number" value={p.amount || ''} onChange={(e) => dispatch({ type: 'updatePayment', id: p.id, patch: { amount: Number(e.target.value) } })} />
                    </label>
                    <label className="field">
                      <span>Due</span>
                      <input type="date" value={p.dueDate} onChange={(e) => dispatch({ type: 'updatePayment', id: p.id, patch: { dueDate: e.target.value } })} />
                    </label>
                  </div>
                </div>
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={Boolean(p.paidDate)}
                    onChange={(e) =>
                      dispatch({
                        type: 'updatePayment',
                        id: p.id,
                        patch: { paidDate: e.target.checked ? new Date().toISOString().slice(0, 10) : '' },
                      })
                    }
                  />
                  Paid
                </label>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
