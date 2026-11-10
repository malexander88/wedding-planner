import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { HIDDEN_EXTRAS } from '../data/hiddenExtras'
import { draftEnquiry } from '../lib/enquiry'
import { uid } from '../lib/ids'
import { gbp } from '../lib/money'
import { useStore } from '../state/store'
import type { Quote, SupplierStatus } from '../types'

const STATUSES: SupplierStatus[] = ['shortlisted', 'enquired', 'quoted', 'viewed', 'booked', 'rejected']

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

  if (!supplier) {
    return (
      <div className="card">
        <p>We couldn’t find that supplier.</p>
        <Link to="/find">Back to Find</Link>
      </div>
    )
  }

  const draft = draftEnquiry(state, supplier)
  const latest = quotes[quotes.length - 1]

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
  }

  return (
    <div className="grid">
      <section className="card hero">
        <Link to="/find" className="tiny">← All suppliers</Link>
        <h1>{supplier.name}</h1>
        <p>{supplier.area}{supplier.phone ? ` · ${supplier.phone}` : ''}</p>
        <div className="chips">
          {STATUSES.map((st) => (
            <button
              key={st}
              className={`chip ${supplier.status === st ? 'on' : ''}`}
              type="button"
              onClick={() => dispatch({ type: 'setSupplierStatus', id: supplier.id, status: st })}
            >
              {st}
            </button>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          {supplier.website && (
            <a className="btn secondary" href={supplier.website} target="_blank" rel="noreferrer">Website</a>
          )}
          <button className="btn" type="button" onClick={() => setShowDraft(true)}>Draft an enquiry</button>
          {supplier.status !== 'booked' && (
            <button className="btn sage" type="button" onClick={() => setBooking(true)}>Book them</button>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Notes</h2>
        <textarea
          value={supplier.notes}
          onChange={(e) => dispatch({ type: 'updateSupplier', id: supplier.id, patch: { notes: e.target.value } })}
          placeholder="What you liked, questions to ask, who you spoke to…"
        />
      </section>

      <section className="card">
        <h2>Add a quote</h2>
        <div className="grid-2">
          <label className="field">
            <span>Label</span>
            <input value={quoteForm.label} onChange={(e) => setQuoteForm({ ...quoteForm, label: e.target.value })} />
          </label>
          <label className="field">
            <span>Amount (£)</span>
            <input type="number" value={quoteForm.amount} onChange={(e) => setQuoteForm({ ...quoteForm, amount: e.target.value })} />
          </label>
        </div>
        <label className="inline" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={quoteForm.vatIncluded} onChange={(e) => setQuoteForm({ ...quoteForm, vatIncluded: e.target.checked })} />
          Quote includes VAT
        </label>
        <label className="field">
          <span>What’s included</span>
          <textarea value={quoteForm.inclusions} onChange={(e) => setQuoteForm({ ...quoteForm, inclusions: e.target.value })} />
        </label>
        <label className="field">
          <span>What’s not included</span>
          <textarea value={quoteForm.exclusions} onChange={(e) => setQuoteForm({ ...quoteForm, exclusions: e.target.value })} />
        </label>
        <h3>Hidden extras to ask about</h3>
        {HIDDEN_EXTRAS.map((ex) => (
          <label className="field" key={ex.id}>
            <span>{ex.question}</span>
            <input
              value={extras[ex.id] ?? ''}
              onChange={(e) => setExtras({ ...extras, [ex.id]: e.target.value })}
              placeholder="Their answer"
            />
          </label>
        ))}
        <button className="btn" type="button" onClick={addQuote}>Save quote</button>
      </section>

      {others.length > 0 && (
        <section className="card">
          <h2>Compare quotes</h2>
          <div className="compare-list">
            {others.map((q) => {
              const owner = state.suppliers.find((s) => s.id === q.supplierId)
              const extras = Object.entries(q.hiddenExtras).filter(([, v]) => v)
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
                  {extras.length > 0 && extras.map(([k, v]) => (
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
