import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HygieneBadge } from '../components/HygieneCard'
import { VenueArt } from '../components/VenueArt'
import { IconBack } from '../components/Icons'
import { comparableVenues, compareColumn, MAX_COMPARE, pickCompare, type CompareColumn } from '../data/compare'
import { formatShort } from '../data/legal'
import { gbp, money } from '../lib/money'
import { sessionPhoto, sessionRating, venuePhotoKey } from '../lib/places'
import { useHygiene, supplierQuery } from '../lib/useHygiene'
import { useStore } from '../state/store'

const AVAIL_WORDS = { unknown: 'Not asked', available: 'Free', hold: 'On hold', unavailable: 'Taken' } as const

export function VenueCompare() {
  const { state } = useStore()
  const [params, setParams] = useSearchParams()
  const all = comparableVenues(state)
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean)
  const shown = pickCompare(all, ids)
  const cols = shown.map((s) => compareColumn(state, s))
  const toggle = (id: string) => {
    const cur = shown.map((s) => s.id)
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_COMPARE ? cur : [...cur, id]
    setParams(next.length ? { ids: next.join(',') } : {}, { replace: true })
  }
  const date = state.profile.date
  const guests = state.profile.estimatedDayGuests

  return (
    <div className="grid compare-page">
      <header className="page-head">
        <Link to="/find?view=mine" className="text-btn back-link">
          <IconBack style={{ width: 16, height: 16 }} /> Your venues
        </Link>
        <h1>Compare venues</h1>
        <p>Pick two to four from your shortlist. Everything here comes from what you’ve saved or checked facts — nothing is guessed.</p>
      </header>

      {all.length < 2 ? (
        <div className="card empty">Save at least two venues to your shortlist to compare them side by side.</div>
      ) : (
        <>
          <div className="card compare-picker" role="group" aria-label="Venues to compare">
            <div className="chips">
              {all.map((s) => {
                const on = shown.some((x) => x.id === s.id)
                return (
                  <button key={s.id} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} disabled={!on && shown.length >= MAX_COMPARE} onClick={() => toggle(s.id)}>
                    {s.name}
                  </button>
                )
              })}
            </div>
            <p className="tiny">{shown.length < 2 ? 'Pick one more to compare.' : `Comparing ${shown.length} of ${all.length}. Up to ${MAX_COMPARE} at once.`}</p>
          </div>

          {shown.length >= 1 && (
            <div className="card compare-wrap">
              <div className="compare-scroll" tabIndex={0} aria-label="Comparison table (scrolls sideways)">
                <table className="compare-table" style={{ ['--cols' as string]: cols.length }}>
                  <thead>
                    <tr>
                      <td />
                      {cols.map((c) => (
                        <th key={c.s.id} scope="col">
                          <Link to={`/find/${c.s.id}`} className="ct-head">
                            <VenueArt
                              type={c.dir?.type ?? 'other'}
                              seed={c.s.id}
                              photo={c.dir?.photo}
                              google={sessionPhoto(c.s.placeId ? `place:${c.s.placeId}` : null) ?? (c.dir ? sessionPhoto(venuePhotoKey(c.dir.name, c.dir.town)) : null)}
                              className="ct-art"
                            />
                            <strong>{c.s.name}</strong>
                            <span className="tiny">{c.dir?.town || c.s.area}</span>
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <Row label="Type" cols={cols} cell={(c) => c.type} />
                    <Row
                      label="Capacity"
                      cols={cols}
                      cell={(c) =>
                        c.capacity ? (
                          <>
                            Up to {c.capacity}
                            {c.fitsGuests !== null && <span className={`pill ${c.fitsGuests ? 'ok' : 'warn'} ct-pill`}>{c.fitsGuests ? `Fits ${guests}` : `Under ${guests}`}</span>}
                          </>
                        ) : (
                          <span className="muted">Not published — ask</span>
                        )
                      }
                    />
                    <Row label="Distance" cols={cols} cell={(c) => c.distance || <span className="muted">No map pin</span>} />
                    <Row
                      label="Your price"
                      cols={cols}
                      cell={(c) =>
                        c.price ? (
                          <>
                            <b>{money(c.price.amount)}</b> <span className="tiny">{c.price.kind === 'booked' ? 'booked' : 'latest quote'}</span>
                          </>
                        ) : (
                          <span className="muted">No quote yet</span>
                        )
                      }
                    />
                    <Row
                      label="Registrar fee"
                      cols={cols}
                      cell={(c) =>
                        c.fee.weekday !== null ? (
                          <>
                            {date && c.fee.onDate !== null && (
                              <>
                                <b>{gbp(c.fee.onDate)}</b> <span className="tiny">on {formatShort(date)}</span>
                                <br />
                              </>
                            )}
                            <span className="tiny">
                              {gbp(c.fee.weekday)} weekday · {c.fee.saturday !== null ? `${gbp(c.fee.saturday)} Sat` : 'Sat: ask'}
                            </span>
                          </>
                        ) : (
                          <span className="tiny muted">{c.fee.label}</span>
                        )
                      }
                    />
                    {date && <Row label={`Free on ${formatShort(date)}?`} cols={cols} cell={(c) => <span className={`avail-word a-${c.availability}`}>{AVAIL_WORDS[c.availability ?? 'unknown']}</span>} />}
                    <Row
                      label="Google rating"
                      cols={cols}
                      cell={(c) => {
                        const r = sessionRating(c.s.placeId ? `place:${c.s.placeId}` : null, venuePhotoKey(c.dir?.name ?? c.s.name, c.dir?.town ?? c.s.area))
                        return r ? (
                          <>
                            <b>{r.rating.toFixed(1)}★</b> {r.count ? <span className="tiny">({r.count.toLocaleString('en-GB')})</span> : null}
                          </>
                        ) : (
                          <span className="tiny muted">Open the venue to load</span>
                        )
                      }}
                    />
                    <tr>
                      <th scope="row">Food hygiene</th>
                      {cols.map((c) => (
                        <td key={c.s.id}>
                          <HygieneCell col={c} />
                        </td>
                      ))}
                    </tr>
                    <Row label="Status" cols={cols} cell={(c) => <span className="pill" style={{ textTransform: 'capitalize' }}>{c.s.status}</span>} />
                    <Row label="Your notes" cols={cols} cell={(c) => (c.notes ? <span className="ct-notes">{c.notes}</span> : <span className="muted">—</span>)} />
                  </tbody>
                </table>
              </div>
              <p className="tiny compare-foot">
                Registrar fees are each council’s published sterling prices. Google ratings show only for venues opened this session (to keep within the free daily
                limit). Food hygiene ratings from the{' '}
                <a href="https://ratings.food.gov.uk/" target="_blank" rel="noreferrer">Food Standards Agency</a> (Open Government Licence).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Row({ label, cols, cell }: { label: string; cols: CompareColumn[]; cell: (c: CompareColumn) => ReactNode }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {cols.map((c) => (
        <td key={c.s.id}>{cell(c)}</td>
      ))}
    </tr>
  )
}

function HygieneCell({ col }: { col: CompareColumn }) {
  const state = useHygiene(supplierQuery(col.s))
  if (state?.status === 'match')
    return (
      <a href={state.match.url} target="_blank" rel="noreferrer" className="ct-fhrs" title={`${state.match.name}, ${state.match.address}`}>
        <HygieneBadge state={state} />
      </a>
    )
  return <HygieneBadge state={state} compact />
}
