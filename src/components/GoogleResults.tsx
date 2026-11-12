import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categoryPlural } from '../data/categories'
import { approvedMatch, googleQuery, resultKm, townFromAddress } from '../data/googleFind'
import { fetchPlaceDetails, problemText, searchPlaces, sessionPhoto, type PlaceDetails, type PlaceResult, type PlacesProblem } from '../lib/places'
import { newSupplier, useStore } from '../state/store'
import type { SupplierCategory } from '../types'
import { Sheet } from './Sheet'

/** Google's required attribution when showing Places content without a Google map. */
export function GoogleAttribution() {
  return (
    <span className="google-attr-mark" translate="no" aria-label="Results from Google Maps">
      Google Maps
    </span>
  )
}

type State = { kind: 'idle' } | { kind: 'loading'; query: string } | { kind: 'done'; query: string; results: PlaceResult[] } | { kind: 'problem'; query: string; problem: PlacesProblem }

/** Google results beyond the approved list / starter list. Only searches when asked, to save the daily allowance. */
export function GoogleResults({ category, q, area }: { category: SupplierCategory; q: string; area: string }) {
  const [raw, setSt] = useState<State>({ kind: 'idle' })
  const [open, setOpen] = useState<PlaceResult | null>(null)
  const query = googleQuery(category, area, q)
  const what = categoryPlural(category)
  // A new category or search term goes back to the button rather than spending a call automatically.
  const st: State = raw.kind !== 'idle' && raw.query !== query ? { kind: 'idle' } : raw

  const run = async () => {
    setSt({ kind: 'loading', query })
    const r = await searchPlaces(query)
    setSt(r.ok ? { kind: 'done', query, results: r.data } : { kind: 'problem', query, problem: r.problem })
  }

  return (
    <section className="card google-results" aria-label="Google results">
      <div className="gr-head">
        <div>
          <h2>More from Google</h2>
          <p className="tiny">
            {category === 'venue' ? 'Places beyond the approved list — hotels, barns, restaurants and more.' : `Local ${what} with photos, ratings and opening hours.`}
          </p>
        </div>
      </div>
      {st.kind === 'idle' && (
        <button type="button" className="btn secondary gr-go" onClick={run}>
          Search Google for “{query.replace(/, Northern Ireland$/, '')}”
        </button>
      )}
      {st.kind === 'loading' && (
        <div className="gr-list" aria-live="polite" aria-busy="true">
          <span className="sr-only">Searching Google…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-row" aria-hidden="true">
              <span className="skeleton w60" />
              <span className="skeleton w90" />
            </div>
          ))}
        </div>
      )}
      {st.kind === 'problem' && (
        <div className="gr-problem" role="status">
          <p>{problemText(st.problem)}</p>
          {st.problem === 'down' && (
            <button type="button" className="btn ghost small" onClick={run}>
              Try again
            </button>
          )}
        </div>
      )}
      {st.kind === 'done' && (
        <>
          {st.results.length === 0 ? (
            <p className="tiny">Google found nothing for that in Northern Ireland. Try other words in the search box.</p>
          ) : (
            <ul className="gr-list">
              {st.results.map((r) => (
                <ResultRow key={r.id} r={r} category={category} onOpen={() => setOpen(r)} />
              ))}
            </ul>
          )}
          <p className="tiny gr-foot">
            Results for “{st.query}” from <GoogleAttribution />. Tap one for photos, rating, hours and contact details.
          </p>
        </>
      )}
      {open && <PlaceSheet result={open} category={category} onClose={() => setOpen(null)} />}
    </section>
  )
}

function ResultRow({ r, category, onOpen }: { r: PlaceResult; category: SupplierCategory; onOpen: () => void }) {
  const { state } = useStore()
  const approved = category === 'venue' ? approvedMatch(r) : null
  const saved = state.suppliers.find((s) => s.placeId === r.id)
  const km = resultKm(r)
  const thumb = sessionPhoto(`place:${r.id}`)
  return (
    <li>
      <button type="button" className={`gr-row${thumb ? ' has-thumb' : ''}`} onClick={onOpen}>
        {thumb && <img className="gr-thumb" src={thumb.url} alt="" loading="lazy" />}
        <span className="gr-name">{r.name}</span>
        <span className="gr-meta tiny">
          {[r.type, r.address].filter(Boolean).join(' · ')}
          {km !== null && ` · ${km < 10 ? km.toFixed(1) : Math.round(km)} km`}
          {thumb && ` · Photo: ${thumb.attributions.map((a) => a.name).join(', ') || 'Google user'}`}
        </span>
        <span className="badges">
          {r.closed && <span className="b out">Permanently closed</span>}
          {approved && <span className="b diet">On the approved list</span>}
          {saved && <span className="b eve">On your shortlist</span>}
        </span>
      </button>
    </li>
  )
}

export function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating * 2) / 2
  return (
    <span className="stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? 'on' : i - 0.5 === full ? 'half' : ''}>
          ★
        </span>
      ))}
    </span>
  )
}

export function PlaceSheet({ result, category, onClose }: { result: PlaceResult; category: SupplierCategory; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [d, setD] = useState<PlaceDetails | null>(null)
  const [problem, setProblem] = useState<PlacesProblem | null>(null)
  useEffect(() => {
    let live = true
    fetchPlaceDetails(result.id).then((r) => {
      if (!live) return
      if (r.ok) setD(r.data)
      else setProblem(r.problem)
    })
    return () => {
      live = false
    }
  }, [result.id])
  const approved = category === 'venue' ? approvedMatch(result) : null
  const saved = state.suppliers.find((s) => s.placeId === result.id)
  const mapsUrl = d?.mapsUrl ?? result.mapsUrl

  const save = () => {
    // Only the name (what the couple calls it) and Google's place_id are kept; the rest is fetched fresh.
    const s = newSupplier({ name: result.name, category, area: townFromAddress(d?.address ?? result.address), placeId: result.id, website: '', phone: '', notes: '' })
    dispatch({ type: 'addSupplier', supplier: s })
    navigate(`/find/${s.id}`)
  }

  return (
    <Sheet id="ps" kicker={result.type ?? 'From Google'} title={result.name} onClose={onClose}>
      {!d && !problem && (
        <div aria-busy="true">
          <span className="sr-only">Loading details from Google…</span>
          <div className="skeleton photo" aria-hidden="true" />
          <span className="skeleton w60" aria-hidden="true" />
          <span className="skeleton w90" aria-hidden="true" />
          <span className="skeleton w40" aria-hidden="true" />
        </div>
      )}
      {problem && <p className="gr-problem">{problemText(problem)}</p>}
      {(d?.closed || result.closed) && <p className="pill warn">Google lists this place as permanently closed.</p>}
      {d?.photo && (
        <figure className="ps-photo">
          <img src={d.photo.url} alt={`Photo of ${d.name}`} />
          {d.photo.attributions.length > 0 && (
            <figcaption className="tiny">
              Photo:{' '}
              {d.photo.attributions.map((a, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {a.uri ? (
                    <a href={a.uri} target="_blank" rel="noreferrer">
                      {a.name}
                    </a>
                  ) : (
                    a.name
                  )}
                </span>
              ))}
            </figcaption>
          )}
        </figure>
      )}
      {d && (
        <dl className="facts ps-facts">
          {d.rating !== undefined && (
            <>
              <dt>Rating</dt>
              <dd>
                <Stars rating={d.rating} /> <strong>{d.rating.toFixed(1)}</strong> <span className="tiny">({(d.ratingCount ?? 0).toLocaleString('en-GB')} Google reviews)</span>
              </dd>
            </>
          )}
          {!d.hours && (
            <>
              <dt>Opening</dt>
              <dd className="tiny">Hours not listed on Google — venues often open by appointment.</dd>
            </>
          )}
          {d.hours && (
            <>
              <dt>Opening</dt>
              <dd>
                {d.hours.openNow !== undefined && <span className={`b ${d.hours.openNow ? 'eve' : ''}`}>{d.hours.openNow ? 'Open now' : 'Closed now'}</span>}
                {d.hours.days.length > 0 && (
                  <details className="ps-hours">
                    <summary>Opening hours</summary>
                    <ul>
                      {d.hours.days.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </dd>
            </>
          )}
          {d.address && (
            <>
              <dt>Address</dt>
              <dd>{d.address}</dd>
            </>
          )}
          {d.phone && (
            <>
              <dt>Phone</dt>
              <dd>
                <a href={`tel:${d.phone.replace(/\s+/g, '')}`}>{d.phone}</a>
              </dd>
            </>
          )}
          {d.website && (
            <>
              <dt>Website</dt>
              <dd>
                <a href={d.website} target="_blank" rel="noreferrer">
                  {d.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </a>
              </dd>
            </>
          )}
        </dl>
      )}
      {approved && (
        <p className="tiny">
          This is on the approved list, so a registrar can marry you there: <Link to={`/find/place/${approved.id}`}>see {approved.name}</Link>.
        </p>
      )}
      <div className="sheet-actions">
        {saved ? (
          <Link className="btn" to={`/find/${saved.id}`}>
            On your shortlist — open
          </Link>
        ) : (
          <button className="btn" type="button" onClick={save}>
            Save to shortlist
          </button>
        )}
        {mapsUrl && (
          <a className="btn ghost" href={mapsUrl} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>
        )}
      </div>
      <p className="tiny ps-attr">
        Details from <GoogleAttribution />. Checked fresh each time you open this; only the name and Google’s place ID are saved.
      </p>
    </Sheet>
  )
}
