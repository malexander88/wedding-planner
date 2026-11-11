import { useState } from 'react'
import { Link } from 'react-router-dom'
import { venueFee } from '../data/venueFee'
import { holidayName, isNiHoliday } from '../data/holidays'
import {
  COUNCILS,
  LINKS,
  checkWeddingDate,
  daysBetween,
  feeForDate,
  formatLong,
  seasonOf,
  todayIso,
  weekdayIndex,
  type CouncilId,
} from '../data/legal'
import { gbp } from '../lib/money'
import { useStore } from '../state/store'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
type Availability = 'unknown' | 'available' | 'unavailable' | 'hold'
const AVAIL: { id: Availability; label: string }[] = [
  { id: 'unknown', label: 'Not asked' },
  { id: 'available', label: 'Free' },
  { id: 'hold', label: 'On hold' },
  { id: 'unavailable', label: 'Taken' },
]

function shortDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function Dates() {
  const { state, dispatch } = useStore()
  const today = todayIso()
  const thisMonth = today.slice(0, 7)
  const [cursor, setCursor] = useState(thisMonth)
  const [y, m] = cursor.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = Array.from({ length: startPad }, () => null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)

  const pm = state.profile.previouslyMarried
  const venues = state.suppliers.filter((s) => s.category === 'venue' && s.status !== 'rejected')
  const venueFees = venues.map((v) => ({ v, fee: venueFee(v) }))
  const councilsShown = new Set<CouncilId>(
    venueFees.length ? venueFees.flatMap(({ fee }) => (fee.council ? [fee.council] : [])) : (['anbc', 'belfast', 'mea'] as CouncilId[]),
  )
  const shift = (delta: number) => {
    const dt = new Date(y, m - 1 + delta, 1)
    setCursor(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
  }
  const candidates = state.profile.candidateDates

  const chooseDate = (iso: string) => {
    const check = checkWeddingDate(iso, today, pm)
    if (check.level === 'past') return
    if (check.level === 'blocked' && !window.confirm(`${check.text}\n\nUse it anyway?`)) return
    dispatch({ type: 'setDate', date: iso })
  }

  return (
    <div className="grid">
      <header className="page-head">
        <div className="kicker">Date comparer</div>
        <h1>Find a day that works</h1>
        <p>
          Add a few possible dates. We’ll flag Northern Ireland bank holidays, the 28-day notice minimum, and the registrar fee for each venue’s own council.
          Mark whether each venue is free — the app can’t see their diaries, so this is for notes after you ask.
        </p>
      </header>

      <section className="card">
        <div className="row" style={{ paddingTop: 0 }}>
          <button className="btn secondary small" type="button" onClick={() => shift(-1)} disabled={cursor <= thisMonth}>Previous</button>
          <h2 style={{ margin: 0 }}>
            {first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </h2>
          <button className="btn secondary small" type="button" onClick={() => shift(1)}>Next</button>
        </div>
        <div className="cal">
          {DOW.map((d) => (
            <div key={d} className="dow">{d}</div>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <div key={`e${i}`} />
            const check = checkWeddingDate(iso, today, pm)
            const past = check.level === 'past'
            const on = candidates.includes(iso)
            const hol = holidayName(iso)
            return (
              <button
                key={iso}
                type="button"
                disabled={past && !on}
                className={[on && 'on', isNiHoliday(iso) && 'holiday', past && 'past', check.level === 'blocked' && 'too-soon'].filter(Boolean).join(' ')}
                onClick={() => (on ? dispatch({ type: 'removeCandidate', date: iso }) : !past && dispatch({ type: 'addCandidate', date: iso }))}
                title={[hol, past ? 'Already passed' : check.level === 'blocked' ? 'Too soon to give notice' : ''].filter(Boolean).join(' · ') || iso}
                aria-label={`${formatLong(iso)}${hol ? `, ${hol}` : ''}${past ? ', passed' : check.level === 'blocked' ? ', too soon to give notice' : ''}${on ? ', in your comparison' : ''}`}
              >
                {Number(iso.slice(8))}
              </button>
            )
          })}
        </div>
        <div className="cal-legend tiny">
          <span><i className="lg-holiday" /> Bank holiday</span>
          <span><i className="lg-soon" /> Under 28 days — too soon to give notice</span>
          <span><i className="lg-past" /> Passed</span>
        </div>
      </section>

      {candidates.length > 0 && (
        <section className="card">
          <h2>Side by side</h2>
          <div className="compare-list">
            {candidates.map((iso) => {
              const holiday = holidayName(iso)
              const day = weekdayIndex(iso)
              const check = checkWeddingDate(iso, today, pm)
              const days = daysBetween(today, iso)
              return (
                <article key={iso} className={`compare-card${check.level === 'past' ? ' is-past' : ''}`}>
                  <strong>{formatLong(iso)}</strong>
                  <div className="chips" style={{ marginTop: 8 }}>
                    {state.profile.date === iso && <span className="pill ok">Chosen</span>}
                    {check.level === 'past' && <span className="pill neutral">Passed</span>}
                    {check.level === 'blocked' && <span className="pill danger">Too soon for notice</span>}
                    {check.level === 'tight' && <span className="pill warn">Notice is tight</span>}
                    {holiday && <span className="pill warn">{holiday}</span>}
                    <span className="pill neutral" style={{ textTransform: 'capitalize' }}>{seasonOf(iso)}</span>
                    {day === 6 && <span className="pill">Saturday</span>}
                    {day === 0 && <span className="pill">Sunday</span>}
                    {days >= 0 && <span className="pill neutral">{days} days away</span>}
                  </div>
                  {check.text && check.level !== 'past' && <p className={`date-warn ${check.level}`}>{check.text}</p>}
                  <ul className="fee-lines">
                    {venueFees.length
                      ? venueFees.map(({ v, fee }) => {
                          const f = fee.band ? feeForDate(iso, fee.band) : null
                          return (
                            <li key={v.id}>
                              <span>{v.name}</span>
                              <b>{f ? (f.amount === null ? 'No ceremonies' : gbp(f.amount)) : <Link to={`/find/${v.id}`}>Set council</Link>}</b>
                            </li>
                          )
                        })
                      : (['anbc', 'belfast', 'mea'] as CouncilId[]).map((id) => {
                          const f = feeForDate(iso, COUNCILS[id].approved)
                          return (
                            <li key={id}>
                              <span>Approved venue · {COUNCILS[id].short}</span>
                              <b>{f.amount === null ? 'No ceremonies' : gbp(f.amount)}</b>
                            </li>
                          )
                        })}
                  </ul>
                  <div className="btn-row">
                    {state.profile.date !== iso && check.level !== 'past' && (
                      <button className="btn small" type="button" onClick={() => chooseDate(iso)}>
                        Use this date
                      </button>
                    )}
                    <button className="btn ghost small" type="button" onClick={() => dispatch({ type: 'removeCandidate', date: iso })}>
                      Remove
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          <p className="tiny fee-note">
            Registrar fees for the day of the week, from each council’s published list. Venue hire is extra at hotels and private venues, and
            weekday evening ceremonies can cost more (<a href={LINKS.civil} target="_blank" rel="noreferrer">nidirect</a>). Sources:{' '}
            {[...councilsShown].map((id, i) => (
              <span key={id}>
                {i > 0 && ' · '}
                <a href={COUNCILS[id].sourceUrl} target="_blank" rel="noreferrer">{COUNCILS[id].sourceLabel}</a>
              </span>
            ))}
            . Always confirm with the registrar — published figures can change.
          </p>
        </section>
      )}

      {venues.length > 0 && candidates.length > 0 && (
        <section className="card">
          <h2>Venue availability by date</h2>
          <p>After you speak to a venue, mark whether each date is free, on hold, or taken.</p>
          <div className="avail-list">
            {venueFees.map(({ v, fee }) => (
              <article key={v.id} className="avail-venue">
                <header>
                  <Link to={`/find/${v.id}`}><strong>{v.name}</strong></Link>
                  <div className="tiny">{fee.label}</div>
                </header>
                {candidates.map((d) => {
                  const cur = (state.venueDates.find((x) => x.supplierId === v.id && x.date === d)?.availability ?? 'unknown') as Availability
                  return (
                    <div key={d} className="avail-row">
                      <span className="avail-date">{shortDate(d)}</span>
                      <div className="seg" role="radiogroup" aria-label={`${v.name} on ${formatLong(d)}`}>
                        {AVAIL.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            role="radio"
                            aria-checked={cur === a.id}
                            className={`seg-btn ${a.id}${cur === a.id ? ' on' : ''}`}
                            onClick={() => dispatch({ type: 'setAvailability', supplierId: v.id, date: d, availability: a.id })}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
