import { useMemo, useState } from 'react'
import { parseGuestText, recordsFor, sideLabel } from '../../data/guests'
import { useStore } from '../../state/store'
import { Sheet } from '../Sheet'
import { AddControls, type AddDefaults } from './AddControls'

export function BulkPasteSheet({ defaults, onClose, onAdded }: { defaults: AddDefaults; onClose: () => void; onAdded: (households: number, people: number) => void }) {
  const { state, dispatch } = useStore()
  const names = { a: state.profile.partnerAName || 'Partner 1', b: state.profile.partnerBName || 'Partner 2' }
  const [text, setText] = useState('')
  const [opts, setOpts] = useState<AddDefaults>(defaults)
  const parsed = useMemo(() => parseGuestText(text, { ...opts, names }), [text, opts, names.a, names.b]) // eslint-disable-line react-hooks/exhaustive-deps
  const people = parsed.reduce((n, p) => n + p.people.length, 0)

  return (
    <Sheet id="bp" kicker="Bulk paste" title="Paste a list" onClose={onClose} wide>
      <p className="tiny">
        One household per line. <code>Anna &amp; Tom Smith +1</code> · <code>Ella Byrne (evening)</code> · <code>Ciara &amp; Dan Quinn, kids: Ben, Ella</code> ·{' '}
        <code>#uni</code> adds a tag. Rows copied from a spreadsheet can have columns for side ({names.a} / {names.b} / Both), Day or Evening, and group.
      </p>
      <AddControls value={opts} onChange={setOpts} state={state} idPrefix="bp" />
      <label className="field" style={{ marginTop: 12 }}>
        <span>Your list</span>
        <textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Anna & Tom Smith +1\nGranny Rose\nCiara & Dan Quinn, kids: Ben, Ella\nMark Doyle (evening) #work'}
          aria-label="Your list"
        />
      </label>
      {parsed.length > 0 && (
        <div className="bp-preview" aria-live="polite">
          <div className="tiny">
            Will add <strong>{parsed.length}</strong> {parsed.length === 1 ? 'household' : 'households'} and <strong>{people}</strong>{' '}
            {people === 1 ? 'person' : 'people'}:
          </div>
          <ul>
            {parsed.slice(0, 40).map((p, i) => (
              <li key={i}>
                <strong>{p.name}</strong>
                <span className="tiny">
                  {' '}
                  · {p.people.map((x) => (x.plusOne ? '+1' : `${x.first}${x.child ? ' (child)' : ''}`)).join(', ') || 'no names yet'} ·{' '}
                  {p.invite === 'day' ? 'Day' : 'Evening'} · {sideLabel(p.side, names)}
                  {p.group ? ` · ${p.group}` : ''}
                  {p.tags.length ? ` · ${p.tags.map((t) => `#${t}`).join(' ')}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {parsed.length > 40 && <div className="tiny">…and {parsed.length - 40} more.</div>}
        </div>
      )}
      <div className="sheet-actions">
        <button
          className="btn"
          type="button"
          disabled={!parsed.length}
          onClick={() => {
            const r = recordsFor(parsed)
            dispatch({ type: 'addGuests', households: r.households, guests: r.guests })
            onAdded(r.households.length, r.guests.length)
            onClose()
          }}
        >
          {parsed.length ? `Add ${parsed.length} ${parsed.length === 1 ? 'household' : 'households'}` : 'Add'}
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  )
}
