import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconBack, IconPrint } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { formatLong } from '../data/legal'
import {
  CEREMONY_ID,
  dayContacts,
  defaultRunSheet,
  EVENING_ID,
  eventStart,
  shiftRunSheet,
  sortRunSheet,
  toMinutes,
  withDefaults,
} from '../data/runSheet'
import { oddsFor } from '../lib/climate'
import { uid } from '../lib/ids'
import { climatePlace, useClimate } from '../lib/useClimate'
import { useStore } from '../state/store'
import type { RunSheetItem } from '../types'

function useSunset(): string | null {
  const { state } = useStore()
  const place = climatePlace(state)
  const climate = useClimate(place.lat, place.lng)
  const date = state.profile.date
  if (!date || climate.status !== 'ok') return null
  return oddsFor(climate.data, date)?.sunset ?? null
}

const fmtDelta = (d: number) => `${d > 0 ? '+' : '−'}${Math.floor(Math.abs(d) / 60) ? `${Math.floor(Math.abs(d) / 60)}h ` : ''}${Math.abs(d) % 60 ? `${Math.abs(d) % 60} min` : ''}`.trim()

export function RunSheet() {
  const { state, dispatch } = useStore()
  const ceremony = eventStart(state, CEREMONY_ID)
  const evening = eventStart(state, EVENING_ID)
  const sunset = useSunset()
  const items = useMemo(() => sortRunSheet(state.runSheet), [state.runSheet])
  const timed = items.filter((x) => toMinutes(x.time) !== null)
  const untimed = items.filter((x) => toMinutes(x.time) === null)
  const contacts = useMemo(() => dayContacts(state), [state])
  const [editing, setEditing] = useState<RunSheetItem | null>(null)
  const [shift, setShift] = useState<number | null>(null)
  const venue = state.suppliers.find((s) => s.id === state.profile.venueSupplierId)
  const names = [state.profile.partnerAName, state.profile.partnerBName].filter(Boolean).join(' & ')

  const setCeremony = (v: string) => {
    const before = toMinutes(ceremony)
    const after = toMinutes(v)
    dispatch({ type: 'setEventStart', id: CEREMONY_ID, start: v })
    if (before !== null && after !== null && after !== before && timed.length) setShift(after - before)
    else setShift(null)
  }

  // The sunset marker sits among the timed rows.
  const sunsetMin = toMinutes(sunset ?? '')
  const rows: ({ kind: 'item'; item: RunSheetItem } | { kind: 'sunset' })[] = []
  let sunsetPlaced = sunsetMin === null
  for (const item of timed) {
    if (!sunsetPlaced && (toMinutes(item.time) ?? 0) > sunsetMin!) {
      rows.push({ kind: 'sunset' })
      sunsetPlaced = true
    }
    rows.push({ kind: 'item', item })
  }
  if (!sunsetPlaced && timed.length) rows.push({ kind: 'sunset' })

  const row = (item: RunSheetItem) => {
    const sup = item.supplierId ? state.suppliers.find((s) => s.id === item.supplierId) : undefined
    return (
      <li key={item.id} className="rs-row">
        <span className="rs-time">{item.time || '—'}</span>
        <div className="rs-body">
          <strong>{item.title}</strong>
          {item.owner && <span className="rs-owner">{item.owner}</span>}
          {item.notes && <p className="rs-notes">{item.notes}</p>}
          {sup && (
            <Link className="tiny no-print" to={`/find/${sup.id}`}>
              {sup.name}
            </Link>
          )}
        </div>
        <button type="button" className="text-btn no-print" onClick={() => setEditing(item)} aria-label={`Edit ${item.title}`}>
          Edit
        </button>
      </li>
    )
  }

  return (
    <div className="grid runsheet-page">
      <header className="page-head">
        <Link to="/" className="text-btn back-link no-print">
          <IconBack style={{ width: 16, height: 16 }} /> Home
        </Link>
        <h1>Run sheet</h1>
        <p>
          {names ? `${names} · ` : ''}
          {state.profile.date ? formatLong(state.profile.date) : 'Date to be set'}
          {venue ? ` · ${venue.name}` : ''}
        </p>
      </header>

      <section className="card rs-setup no-print">
        <div className="rs-times">
          <label className="field">
            <span>Ceremony starts</span>
            <input type="time" value={ceremony} onChange={(e) => setCeremony(e.target.value)} />
          </label>
          <label className="field">
            <span>Evening guests arrive</span>
            <input type="time" value={evening} onChange={(e) => dispatch({ type: 'setEventStart', id: EVENING_ID, start: e.target.value })} />
          </label>
          <div className="rs-sun">
            <span className="tiny">Sunset</span>
            <strong>{sunset ?? '—'}</strong>
            <span className="tiny">{sunset ? 'typical for the date (Open-Meteo history)' : state.profile.date ? 'loading or unavailable' : 'set a date to see it'}</span>
          </div>
        </div>
        {shift !== null && (
          <div className="rs-shift" role="status">
            <span>Ceremony moved {fmtDelta(shift)}. Move the rest of the day too?</span>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                dispatch({ type: 'setRunSheet', items: shiftRunSheet(state.runSheet, shift) })
                setShift(null)
              }}
            >
              Move everything {fmtDelta(shift)}
            </button>
            <button type="button" className="btn ghost small" onClick={() => setShift(null)}>
              Keep times
            </button>
          </div>
        )}
        <div className="btn-row">
          <button
            type="button"
            className="btn secondary small"
            disabled={!ceremony}
            title={ceremony ? undefined : 'Set the ceremony time first'}
            onClick={() => dispatch({ type: 'setRunSheet', items: withDefaults(state.runSheet, defaultRunSheet({ ceremony, evening, sunset })) })}
          >
            {state.runSheet.some((x) => x.id.startsWith('rs-d-')) ? 'Add any missing suggested steps' : 'Suggest a day from the ceremony time'}
          </button>
          <button type="button" className="btn ghost small" onClick={() => setEditing({ id: uid('rs'), time: '', title: '', owner: '', notes: '' })}>
            + Add a step
          </button>
          <button type="button" className="btn ghost small" onClick={() => window.print()} disabled={!items.length}>
            <IconPrint style={{ width: 16, height: 16 }} /> Print or save PDF
          </button>
        </div>
        <p className="tiny">Suggested steps are a starting point. Change any time, title or note; supplier times are yours to agree with them.</p>
      </section>

      {!items.length ? (
        <div className="card empty">
          {ceremony ? 'Tap “Suggest a day” for a starting timeline, or add your own steps.' : 'Set your ceremony time to get a suggested timeline, or add steps yourself.'}
        </div>
      ) : (
        <section className="card rs-list-card">
          <h2>The day</h2>
          <ol className="rs-list">
            {rows.map((r) =>
              r.kind === 'sunset' ? (
                <li key="sunset" className="rs-row rs-sunset">
                  <span className="rs-time">{sunset}</span>
                  <div className="rs-body">
                    <strong>Sunset</strong>
                    <span className="rs-owner">Typical for this date, from past years</span>
                  </div>
                </li>
              ) : (
                row(r.item)
              ),
            )}
          </ol>
          {untimed.length > 0 && (
            <>
              <h3 className="rs-sub">Times to confirm</h3>
              <ol className="rs-list">{untimed.map(row)}</ol>
            </>
          )}
        </section>
      )}

      <section className="card rs-contacts">
        <h2>Supplier contacts</h2>
        {contacts.length ? (
          <ul>
            {contacts.map((c) => (
              <li key={c.key}>
                <div>
                  <strong>{c.name}</strong> <span className="tiny">{c.category}</span>
                  {c.contact && <div className="tiny">Contact: {c.contact}</div>}
                </div>
                <div className="rs-contact-links">
                  {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>{c.phone}</a>}
                  {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                  {!c.phone && !c.email && <span className="tiny">No phone or email saved</span>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tiny">Suppliers you mark as booked (or record in a “Supplier booking” task) appear here with the phone and email you saved.</p>
        )}
      </section>

      {editing && <RunItemSheet item={editing} isNew={!state.runSheet.some((x) => x.id === editing.id)} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RunItemSheet({ item, isNew, onClose }: { item: RunSheetItem; isNew: boolean; onClose: () => void }) {
  const { dispatch } = useStore()
  const [it, setIt] = useState(item)
  return (
    <Sheet id="run-item" kicker="Run sheet" title={isNew ? 'Add a step' : 'Edit step'} onClose={onClose}>
      <div className="rs-edit-row">
        <label className="field">
          <span>Time</span>
          <input type="time" value={it.time} onChange={(e) => setIt({ ...it, time: e.target.value })} />
        </label>
        <label className="field grow">
          <span>What happens</span>
          <input value={it.title} onChange={(e) => setIt({ ...it, title: e.target.value })} placeholder="e.g. Florist delivers buttonholes" />
        </label>
      </div>
      <label className="field">
        <span>Who</span>
        <input value={it.owner} onChange={(e) => setIt({ ...it, owner: e.target.value })} placeholder="e.g. Best man" />
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea rows={3} value={it.notes} onChange={(e) => setIt({ ...it, notes: e.target.value })} />
      </label>
      <div className="btn-row">
        <button
          className="btn"
          type="button"
          disabled={!it.title.trim()}
          onClick={() => {
            dispatch({ type: 'upsertRunItem', item: it })
            onClose()
          }}
        >
          Save
        </button>
        {!isNew && (
          <button
            className="text-btn danger"
            type="button"
            onClick={() => {
              dispatch({ type: 'removeRunItem', id: item.id })
              onClose()
            }}
          >
            Remove
          </button>
        )}
      </div>
    </Sheet>
  )
}
