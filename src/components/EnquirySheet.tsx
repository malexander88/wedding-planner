import { useState } from 'react'
import { buildEnquiry, mailtoUrl, suggestBudgetBand, TONES, type Tone } from '../lib/enquiry'
import { currencySymbol } from '../lib/money'
import { useStore } from '../state/store'
import type { Supplier } from '../types'
import { IconMail } from './Icons'

/**
 * Enquiry draft for one supplier. Drafts only: the couple copies it or opens their own mail app.
 * Shares plan context (date, area, guest counts) and a budget band only if they tick it.
 */
export function EnquirySheet({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [tone, setTone] = useState<Tone>('warm')
  const [shareBudget, setShareBudget] = useState(false)
  const [band, setBand] = useState(() => suggestBudgetBand(state, supplier))
  const make = (t: Tone, share: boolean, b: string) => buildEnquiry(state, supplier, { tone: t, budget: share ? b : '' })
  const [draft, setDraft] = useState(() => make('warm', false, band))
  const [edited, setEdited] = useState(false)
  const [copied, setCopied] = useState(false)

  const regenerate = (t: Tone, share: boolean, b: string) => {
    setDraft(make(t, share, b))
    setEdited(false)
    setCopied(false)
  }
  const markEnquired = () => {
    if (supplier.status === 'shortlisted') dispatch({ type: 'setSupplierStatus', id: supplier.id, status: 'enquired' })
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal enquiry-sheet" role="dialog" aria-modal="true" aria-labelledby="enq-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="enq-title">Enquiry to {supplier.name}</h2>
        <p className="tiny">
          A draft for you to send yourself. The app never sends anything. It shares your date, area and guest numbers only, never names or dietary details.
        </p>

        <div className="seg seg-3" role="radiogroup" aria-label="Tone">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tone === t.id}
              className={`seg-btn${tone === t.id ? ' on' : ''}`}
              title={t.hint}
              onClick={() => {
                if (edited && !confirm('Changing the tone rewrites the draft and loses your edits. Carry on?')) return
                setTone(t.id)
                regenerate(t.id, shareBudget, band)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="enq-budget">
          <label className="check">
            <input
              type="checkbox"
              checked={shareBudget}
              onChange={(e) => {
                if (edited && !confirm('This rewrites the draft and loses your edits. Carry on?')) return
                setShareBudget(e.target.checked)
                regenerate(tone, e.target.checked, band)
              }}
            />
            <span>Mention a budget band</span>
          </label>
          {shareBudget && (
            <input
              className="enq-band"
              aria-label="Budget band"
              value={band}
              placeholder={`e.g. ${currencySymbol()}3,000–${currencySymbol()}4,000`}
              onChange={(e) => {
                setBand(e.target.value)
                regenerate(tone, true, e.target.value)
              }}
            />
          )}
        </div>

        <label className="field">
          <span>Subject</span>
          <input
            value={draft.subject}
            onChange={(e) => {
              setDraft({ ...draft, subject: e.target.value })
              setEdited(true)
            }}
          />
        </label>
        <label className="field">
          <span>Message {edited && <em className="tiny">(edited)</em>}</span>
          <textarea
            className="draft"
            rows={14}
            value={draft.body}
            onChange={(e) => {
              setDraft({ ...draft, body: e.target.value })
              setEdited(true)
            }}
          />
        </label>

        <div className="btn-row">
          <button
            className="btn"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`)
                setCopied(true)
                markEnquired()
              } catch {
                alert('Couldn’t copy automatically. Select the text and copy it instead.')
              }
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <a className="btn secondary" href={mailtoUrl(supplier.email, draft)} onClick={markEnquired}>
            <IconMail style={{ width: 18, height: 18 }} /> Open in mail app
          </a>
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {!supplier.email && <p className="tiny">No email saved for {supplier.name}: your mail app will open with the “To” line empty.</p>}
      </div>
    </div>
  )
}
