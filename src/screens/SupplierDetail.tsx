import { useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { HIDDEN_EXTRAS } from '../data/hiddenExtras'
import { draftEnquiry } from '../lib/enquiry'
import { uid } from '../lib/ids'
import { gbp } from '../lib/money'
import { useStore } from '../state/store'
import type { Quote, Supplier, SupplierStatus } from '../types'
import { COUNCILS } from '../data/legal'
import { venueFee } from '../data/venueFee'
import { IconBack } from '../components/Icons'


function AutoGrowTextarea({ value, onChange, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      className={['autogrow', className].filter(Boolean).join(' ')}
      value={value}
      onChange={onChange}
      rows={2}
      {...rest}
    />
  )
}

const FLOW: SupplierStatus[] = ['shortlisted', 'enquired', 'quoted', 'viewed', 'booked']

export function SupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, dispatch } = useStore()
  const supplier = state.suppliers.find((s) => s.id === id)
  const quotes = state.quotes.filter((q) => q.supplierId === id)
  const others = state.quotes.filter((q) => {
    const owner = state.suppliers.find((s) => s.id === q.supplierId)
    return owner?.category === supplier?.category
  })
  const [showDraft, setShowDraft] = useState(false)
  const [copied, setCopied] = useState(false)
  const [booking, setBooking] = useState(false)
  const [deposit, setDeposit] = useState(0)
  const [depositDue, setDepositDue] = useState('')
  const [balanceDue, setBalanceDue] = useState('')
  const [quoteForm, setQuoteForm] = useState({
    label: 'Main package',
    amount: '',
    vatIncluded: true,
    inclusions: '',
    exclusions: '',
  })
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [openExtra, setOpenExtra] = useState<string | null>(null)

  if (!supplier) {
    return (
      <div className="card">
        <p>We couldn’t find that supplier.</p>
        <Link to="/find" className="btn">Back to Find</Link>
      </div>
    )
  }

  const draft = draftEnquiry(state, supplier)
  const fee = venueFee(supplier)
  const latest = quotes[quotes.length - 1]
  const flowIndex = FLOW.indexOf(supplier.status)

  const addQuote = () => {
    const quote: Quote = {
      id: uid('q'),
      supplierId: supplier.id,
      label: quoteForm.label || 'Quote',
      amount: Number(quoteForm.amount) || 0,
      vatIncluded: quoteForm.vatIncluded,
      vatRate: 20,
      inclusions: quoteForm.inclusions,
      exclusions: quoteForm.exclusions,
      extrasNotes: '',
      hiddenExtras: extras,
      validUntil: '',
      receivedAt: new Date().toISOString(),
    }
    dispatch({ type: 'addQuote', quote })
    setQuoteForm({ label: 'Main package', amount: '', vatIncluded: true, inclusions: '', exclusions: '' })
    setExtras({})
    setOpenExtra(null)
  }

  const setStatus = (status: SupplierStatus) => dispatch({ type: 'setSupplierStatus', id: supplier.id, status })

  return (
    <div className="grid">
      <header className="page-head">
        <Link to="/find" className="text-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <IconBack style={{ width: 16, height: 16 }} /> All suppliers
        </Link>
        <h1>{supplier.name}</h1>
        <p>{supplier.area || 'Area not set'}{supplier.phone ? ` · ${supplier.phone}` : ''}</p>
      </header>

      {!supplier.catalogueId && (
        <section className="card">
          <h2>Where they are</h2>
          <div className="grid-2">
            <label className="field">
              <span>Town or area</span>
              <input
                value={supplier.area}
                placeholder="e.g. Ballymena"
                onChange={(e) => dispatch({ type: 'updateSupplier', id: supplier.id, patch: { area: e.target.value } })}
              />
            </label>
            {supplier.category === 'venue' && (
              <label className="field">
                <span>Registrar council</span>
                <select
                  value={supplier.council ?? ''}
                  onChange={(e) =>
                    dispatch({
                      type: 'updateSupplier',
                      id: supplier.id,
                      patch: { council: (e.target.value || undefined) as Supplier['council'] },
                    })
                  }
                >
                  <option value="">{fee.council && !supplier.council ? `Worked out: ${COUNCILS[fee.council].short}` : 'Not sure yet'}</option>
                  {Object.values(COUNCILS).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {supplier.category === 'venue' && (
            <p className="tiny" style={{ margin: 0 }}>
              {fee.band
                ? `Registrar fees use ${fee.label.toLowerCase()} rates: ${gbp(fee.band.weekday)} weekday, ${gbp(fee.band.saturday)} Saturday, ${gbp(fee.band.holiday)} bank holiday.`
                : 'Add the town, or pick the council, so the date comparer can show the right registrar fees. Councils other than these three: ask the local registrar.'}
            </p>
          )}
        </section>
      )}

      <section className="card">
        <div className="kicker">Status</div>
        <div className="stepper" role="list">
          {FLOW.map((st, i) => {
            const on = supplier.status === st
            const done = flowIndex > i
            return (
              <button
                key={st}
                type="button"
                className={`step${on ? ' on' : ''}${done ? ' done' : ''}`}
                onClick={() => setStatus(st)}
              >
                <span className="dot" />
                <span className="lbl">{st}</span>
              </button>
            )
          })}
        </div>
        <button
          className={`text-btn reject-action${supplier.status === 'rejected' ? ' on' : ''}`}
          type="button"
          onClick={() => setStatus('rejected')}
        >
          Not for us
        </button>
        <div className="supplier-actions">
          <button className="btn enquiry" type="button" onClick={() => setShowDraft(true)}>Draft an enquiry</button>
          {supplier.website && (
            <a className="btn secondary" href={supplier.website} target="_blank" rel="noreferrer">Website</a>
          )}
          {supplier.status !== 'booked' && (
            <button className="btn secondary" type="button" onClick={() => setBooking(true)}>Book them</button>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Notes</h2>
        <AutoGrowTextarea
          value={supplier.notes}
          onChange={(e) => dispatch({ type: 'updateSupplier', id: supplier.id, patch: { notes: e.target.value } })}
          placeholder="What you liked, questions to ask, who you spoke to…"
        />
      </section>

      <section className="card">
        <h2>Add a quote</h2>
        <details className="fold" open>
          <summary>The figure</summary>
          <div className="fold-body">
            <div className="grid-2">
              <label className="field">
                <span>Label</span>
                <input type="text" value={quoteForm.label} onChange={(e) => setQuoteForm({ ...quoteForm, label: e.target.value })} />
              </label>
              <label className="field">
                <span>Amount (£)</span>
                <input type="number" value={quoteForm.amount} onChange={(e) => setQuoteForm({ ...quoteForm, amount: e.target.value })} />
              </label>
            </div>
            <label className="inline">
              <input type="checkbox" checked={quoteForm.vatIncluded} onChange={(e) => setQuoteForm({ ...quoteForm, vatIncluded: e.target.checked })} />
              Quote includes VAT
            </label>
          </div>
        </details>

        <details className="fold">
          <summary>What’s included and not</summary>
          <div className="fold-body">
            <label className="field">
              <span>What’s included</span>
              <AutoGrowTextarea value={quoteForm.inclusions} onChange={(e) => setQuoteForm({ ...quoteForm, inclusions: e.target.value })} placeholder="What they said is included" />
            </label>
            <label className="field">
              <span>What’s not included</span>
              <AutoGrowTextarea value={quoteForm.exclusions} onChange={(e) => setQuoteForm({ ...quoteForm, exclusions: e.target.value })} placeholder="What’s left out" />
            </label>
          </div>
        </details>

        <details className="fold">
          <summary>Hidden extras to ask about</summary>
          <div className="fold-body">
            {HIDDEN_EXTRAS.map((ex) => {
              const open = openExtra === ex.id || extras[ex.id] !== undefined
              return (
                <div className="extra-row" key={ex.id}>
                  <button
                    className="extra-toggle"
                    type="button"
                    onClick={() => {
                      setOpenExtra(openExtra === ex.id ? null : ex.id)
                      setExtras((cur) => (cur[ex.id] === undefined ? { ...cur, [ex.id]: '' } : cur))
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(extras[ex.id])}
                      readOnly
                      tabIndex={-1}
                    />
                    {ex.question}
                  </button>
                  {open && (
                    <input
                      type="text"
                      value={extras[ex.id] ?? ''}
                      onChange={(e) => setExtras({ ...extras, [ex.id]: e.target.value })}
                      placeholder="Their answer"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </details>

        <button className="btn" type="button" onClick={addQuote} style={{ marginTop: 12 }}>Save quote</button>
      </section>

      {others.length > 0 && (
        <section className="card">
          <h2>Compare quotes</h2>
          <div className="compare-list">
            {others.map((q) => {
              const owner = state.suppliers.find((s) => s.id === q.supplierId)
              const extraRows = Object.entries(q.hiddenExtras).filter(([, v]) => v)
              return (
                <article key={q.id} className="compare-card">
                  <div className="row" style={{ paddingTop: 0 }}>
                    <div>
                      <strong>{owner?.name}</strong>
                      <div className="tiny">{q.label}</div>
                    </div>
                    <span className="stat" style={{ fontSize: '1.25rem' }}>{gbp(q.amount)}</span>
                  </div>
                  <p className="tiny">{q.vatIncluded ? 'VAT included' : 'Plus VAT'}</p>
                  {q.inclusions && <p>Included: {q.inclusions}</p>}
                  {extraRows.length > 0 && extraRows.map(([k, v]) => (
                    <div key={k} className="tiny">
                      {HIDDEN_EXTRAS.find((h) => h.id === k)?.question} {v}
                    </div>
                  ))}
                </article>
              )
            })}
          </div>
        </section>
      )}

      {showDraft && (
        <div className="modal-back" onClick={() => setShowDraft(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Enquiry draft</h2>
            <p>Copy this and send it yourself from your own email. The app will not send anything.</p>
            <pre className="draft">{draft}</pre>
            <div className="btn-row">
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(draft)
                  setCopied(true)
                  dispatch({ type: 'setSupplierStatus', id: supplier.id, status: supplier.status === 'shortlisted' ? 'enquired' : supplier.status })
                }}
              >
                {copied ? 'Copied' : 'Copy to clipboard'}
              </button>
              <button className="btn secondary" type="button" onClick={() => setShowDraft(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {booking && (
        <div className="modal-back" onClick={() => setBooking(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Book {supplier.name}</h2>
            <p>
              This will mark them as booked, add or update a budget line
              {latest ? ` for ${gbp(latest.amount)}` : ''}, create deposit and balance payments, and drop a placeholder onto the run sheet.
            </p>
            <label className="field">
              <span>Deposit (£)</span>
              <input type="number" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Deposit due</span>
              <input type="date" value={depositDue} onChange={(e) => setDepositDue(e.target.value)} />
            </label>
            <label className="field">
              <span>Balance due</span>
              <input type="date" value={balanceDue} onChange={(e) => setBalanceDue(e.target.value)} />
            </label>
            <div className="btn-row">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  dispatch({
                    type: 'bookSupplier',
                    supplierId: supplier.id,
                    quoteId: latest?.id,
                    deposit,
                    depositDue,
                    balanceDue,
                  })
                  setBooking(false)
                  navigate('/budget')
                }}
              >
                Confirm booking
              </button>
              <button className="btn secondary" type="button" onClick={() => setBooking(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
