import { Link } from 'react-router-dom'
import { currentStage, STAGES } from '../data/checklist'
import { daysUntil, formatLong } from '../data/legal'
import { totals } from '../data/budgetSeeds'
import { gbp } from '../lib/money'
import { useStore } from '../state/store'

export function Home() {
  const { state, tasks } = useStore()
  const p = state.profile
  const names = [p.partnerAName, p.partnerBName].filter(Boolean).join(' & ') || 'Your wedding'
  const stageId = currentStage(state)
  const stage = STAGES.find((s) => s.id === stageId) ?? STAGES[0]
  const nextTasks = tasks.filter((t) => !t.done).slice(0, 4)
  const money = totals(state)
  const nextPay = [...state.payments]
    .filter((x) => !x.paidDate && x.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  const nextLegal = tasks.filter((t) => t.legal && !t.done && t.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]

  return (
    <div className="grid">
      <section className="card hero">
        <div className="kicker">{p.date ? 'Countdown' : 'No date yet'}</div>
        <h1>{names}</h1>
        {p.date ? (
          <>
            <p>{formatLong(p.date)}</p>
            <div className="stat">{daysUntil(p.date) >= 0 ? `${daysUntil(p.date)} days to go` : 'That’s your wedding day'}</div>
            {nextLegal && (
              <p style={{ marginTop: 12 }}>
                Next legal step: <strong>{nextLegal.title}</strong>
                {nextLegal.dueDate ? ` · by ${formatLong(nextLegal.dueDate)}` : ''}
              </p>
            )}
          </>
        ) : (
          <>
            <p>
              You’re at the <strong>{stage.title.toLowerCase()}</strong> stage. {stage.blurb}
            </p>
            <div className="btn-row">
              <Link className="btn" to="/dates">Compare dates</Link>
              <Link className="btn secondary" to="/find">Find a venue</Link>
            </div>
          </>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Next up</h2>
          {nextTasks.length === 0 ? (
            <p>Everything on the list is ticked. Enjoy that for a moment.</p>
          ) : (
            <div className="list">
              {nextTasks.map((t) => (
                <div key={t.key}>
                  <strong>{t.title}</strong>
                  {t.dueDate && <div className="tiny">Due {formatLong(t.dueDate)}</div>}
                </div>
              ))}
            </div>
          )}
          <Link to="/plan" className="btn ghost small" style={{ marginTop: 14 }}>Open the full plan</Link>
        </section>

        <section className="card">
          <h2>Budget at a glance</h2>
          <div className="stat">{gbp(money.actual || money.quoted || money.estimate)}</div>
          <p>
            Estimated {gbp(money.estimate)} · Quoted {gbp(money.quoted)} of a {gbp(p.totalBudget)} working budget
          </p>
          <div className="progress">
            <div style={{ width: `${Math.min(100, ((money.quoted || money.estimate) / Math.max(p.totalBudget, 1)) * 100)}%` }} />
          </div>
          {nextPay && (
            <p style={{ marginTop: 12 }}>
              Next payment: {gbp(nextPay.amount)} {nextPay.notes && `· ${nextPay.notes}`} {nextPay.dueDate && `· due ${formatLong(nextPay.dueDate)}`}
            </p>
          )}
          <Link to="/budget" className="btn ghost small">Open the budget</Link>
        </section>
      </div>

      <section className="card">
        <h2>Find everything</h2>
        <p>You can hunt by category, start from venues the council has already approved for civil ceremonies, or search Hitched, Bridebook, Google and Maps in one tap.</p>
        <div className="btn-row">
          <Link className="btn" to="/find">Browse suppliers</Link>
          <Link className="btn secondary" to="/guests">Build the guest list</Link>
        </div>
      </section>
    </div>
  )
}
