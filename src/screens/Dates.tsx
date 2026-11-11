import { useMemo, useState } from 'react'
import { holidayName, isNiHoliday } from '../data/holidays'
import {
  ANBC_FEES,
  anbcBandForCatalogueId,
  feeForDate,
  formatLong,
  seasonOf,
  weekdayIndex,
} from '../data/legal'
import { gbp } from '../lib/money'
import { useStore } from '../state/store'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function Dates() {
  const { state, dispatch } = useStore()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [y, m] = cursor.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells = useMemo(() => {
    const list: (string | null)[] = Array.from({ length: startPad }, () => null)
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    return list
  }, [y, m, startPad, daysInMonth])

  const venues = state.suppliers.filter((s) => s.category === 'venue')
  const shift = (delta: number) => {
    const dt = new Date(y, m - 1 + delta, 1)
    setCursor(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="grid">
      <header className="page-head">
        <div className="kicker">Date comparer</div>
        <h1>Find a day that works</h1>
        <p>
          Add a few possible dates. We’ll show Northern Ireland bank holidays and the registrar fee band published by Antrim & Newtownabbey
          Borough Council. Mark whether each shortlisted venue is free — the app cannot see their diaries, so this is for notes after you ask.
        </p>
      </header>

      <section className="card">
        <div className="row" style={{ paddingTop: 0 }}>
          <button className="btn secondary small" type="button" onClick={() => shift(-1)}>Previous</button>
          <h2 style={{ margin: 0 }}>
            {first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </h2>
          <button className="btn secondary small" type="button" onClick={() => shift(1)}>Next</button>
        </div>
        <div className="cal">
          {DOW.map((d) => (
            <div key={d} className="dow">{d}</div>
          ))}
          {cells.map((iso, i) =>
            iso ? (
              <button
                key={iso}
                type="button"
                className={`${state.profile.candidateDates.includes(iso) ? 'on' : ''} ${isNiHoliday(iso) ? 'holiday' : ''}`}
                onClick={() =>
                  state.profile.candidateDates.includes(iso)
                    ? dispatch({ type: 'removeCandidate', date: iso })
                    : dispatch({ type: 'addCandidate', date: iso })
                }
                title={holidayName(iso) ?? iso}
              >
                {Number(iso.slice(8))}
              </button>
            ) : (
              <div key={`e${i}`} />
            ),
          )}
        </div>
        <p className="tiny">Gold outline = UK/NI bank holiday. Tap a day to add or remove it from the comparison.</p>
      </section>

      {state.profile.candidateDates.length > 0 && (
        <section className="card">
          <h2>Side by side</h2>
          <div className="compare-list">
            {state.profile.candidateDates.map((iso) => {
              const holiday = holidayName(iso)
              const day = weekdayIndex(iso)
              const fee = feeForDate(iso, ANBC_FEES.approved)
              const civic = feeForDate(iso, ANBC_FEES.civic)
              return (
                <article key={iso} className="compare-card">
                  <div className="row" style={{ paddingTop: 0 }}>
                    <div>
                      <strong>{formatLong(iso)}</strong>
                      <div className="chips" style={{ marginTop: 8 }}>
                        {state.profile.date === iso && <span className="pill ok">Chosen</span>}
                        {holiday && <span className="pill warn">{holiday}</span>}
                        <span className="pill neutral" style={{ textTransform: 'capitalize' }}>{seasonOf(iso)}</span>
                        {day === 6 && <span className="pill">Saturday</span>}
                        {day === 0 && <span className="pill">Sunday</span>}
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: '10px 0 6px' }}>
                    Approved venue attendance <strong>{gbp(fee.amount)}</strong> ({fee.reason})
                  </p>
                  <p className="tiny">
                    Civic Centre room {gbp(civic.amount)}. Ballyclare Town Hall is a little less. Venue hire is extra at hotels and private venues. Evening weekday ceremonies can cost more on nidirect’s solemnisation table.
                  </p>
                  <div className="btn-row">
                    <button className="btn small" type="button" onClick={() => dispatch({ type: 'setDate', date: iso })}>
                      Use this date
                    </button>
                    <button className="btn ghost small" type="button" onClick={() => dispatch({ type: 'removeCandidate', date: iso })}>
                      Remove
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          <p className="tiny">
            Source: <a href="https://antrimandnewtownabbey.gov.uk/residents/births-deaths-marriages-civil-partnerships/where-to-have-a-ceremony/" target="_blank" rel="noreferrer">ANBC ceremony fees</a>. Always confirm with the registrar — published figures can change.
          </p>
        </section>
      )}

      {venues.length > 0 && state.profile.candidateDates.length > 0 && (
        <section className="card">
          <h2>Venue availability by date</h2>
          <p>After you speak to a venue, mark whether each date is free, on hold, or gone.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Venue</th>
                  {state.profile.candidateDates.map((d) => (
                    <th key={d}>{formatLong(d).split(',')[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {venues.map((v) => (
                  <tr key={v.id}>
                    <td>
                      {v.name}
                      <div className="tiny">{anbcBandForCatalogueId(v.catalogueId).label}</div>
                    </td>
                    {state.profile.candidateDates.map((d) => {
                      const cur = state.venueDates.find((x) => x.supplierId === v.id && x.date === d)?.availability ?? 'unknown'
                      return (
                        <td key={d}>
                          <select
                            value={cur}
                            onChange={(e) =>
                              dispatch({
                                type: 'setAvailability',
                                supplierId: v.id,
                                date: d,
                                availability: e.target.value as 'unknown' | 'available' | 'unavailable' | 'hold',
                              })
                            }
                          >
                            <option value="unknown">Unknown</option>
                            <option value="available">Available</option>
                            <option value="hold">On hold</option>
                            <option value="unavailable">Unavailable</option>
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
