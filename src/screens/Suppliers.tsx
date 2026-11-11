import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CATALOGUE } from '../data/catalogue'
import { CATEGORIES, categoryLabel, categoryPlural } from '../data/categories'
import { COUNCILS, COUNCIL_IDS } from '../data/legal'
import { searchUrls } from '../data/searchLinks'
import {
  DIRECTORY,
  DIRECTORY_SOURCE,
  HOME_BASE,
  VENUE_TYPES,
  formatKm,
  searchVenues,
  venuePlace,
  venueTypeLabel,
  venueTypeOne,
  type DirectoryVenue,
  type VenueSort,
  type VenueType,
} from '../data/venues'
import { newSupplier, useStore } from '../state/store'
import type { CouncilId, Supplier, SupplierCategory } from '../types'
import { CategoryIcon, IconSearch } from '../components/Icons'
import { CategoryArt, VenueArt } from '../components/VenueArt'

const VALID = new Set<string>(CATEGORIES.map((c) => c.id))
const PAGE = 24
const VENUE_COUNT = DIRECTORY.filter((v) => v.kind === 'venue').length
const DISTANCES = [10, 20, 40, 80]
const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])

export function Suppliers() {
  const [urlParams, setUrlParams] = useSearchParams()
  // Finder state lives in React state (so quick successive changes queue properly) and is mirrored
  // to the URL, so a refresh, Back, or a shared link keeps the same search and filters.
  const [state, setState] = useState(() => urlParams.toString())
  const written = useRef(state)
  useEffect(() => {
    if (state === urlParams.toString()) return
    written.current = state
    setUrlParams(new URLSearchParams(state), { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
  useEffect(() => {
    // The URL changed from outside (Back, the nav bar): adopt it.
    const now = urlParams.toString()
    if (now !== written.current) {
      written.current = now
      setState(now)
    }
  }, [urlParams])
  const params = useMemo(() => new URLSearchParams(state), [state])
  const raw = params.get('cat') || 'venue'
  const category = (VALID.has(raw) ? raw : 'venue') as SupplierCategory
  const q = params.get('q') ?? ''
  const set = (patch: Record<string, string | null>) =>
    setState((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k)
        else next.set(k, v)
      }
      return next.toString()
    })
  const setParams = (p: Record<string, string>) => setState(new URLSearchParams(p).toString())

  return (
    <div className="grid find">
      <div className="find-head">
        <div className="find-title">
          <h1>Find</h1>
          <span className="tiny">{category === 'venue' ? `${VENUE_COUNT} approved wedding venues across Northern Ireland` : 'Venues and suppliers'}</span>
        </div>
        <label className="search-box">
          <IconSearch aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => set({ q: e.target.value, n: null })}
            placeholder={category === 'venue' ? 'Search venues, towns or councils' : `Search ${categoryPlural(category)}`}
            aria-label="Search"
          />
        </label>
        <div className="chips scroll cat-row" role="tablist" aria-label="Categories">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              className={`chip ${category === c.id ? 'on' : ''}`}
              type="button"
              onClick={() => setParams({ cat: c.id })}
            >
              <CategoryIcon category={c.id} />
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {category === 'venue' ? <VenueFinder params={params} set={set} /> : <OtherFinder category={category} q={q} />}
    </div>
  )
}

// ---- venues -----------------------------------------------------------

function VenueFinder({ params, set }: { params: URLSearchParams; set: (p: Record<string, string | null>) => void }) {
  const { state } = useStore()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const view = params.get('view') === 'mine' ? 'mine' : 'all'
  const councils = list(params.get('council')) as CouncilId[]
  const types = list(params.get('type')) as VenueType[]
  const maxKm = Number(params.get('km')) || null
  const registrar = params.get('reg') === '1'
  const fit = params.get('fit') === '1'
  const sort = (params.get('sort') === 'az' ? 'az' : 'nearest') as VenueSort
  const shown = Number(params.get('n')) || PAGE
  const guests = state.profile.estimatedDayGuests

  const results = useMemo(
    () =>
      searchVenues(DIRECTORY, {
        q: params.get('q') ?? '',
        councils,
        types,
        maxKm,
        includeRegistrar: registrar,
        minCapacity: fit ? guests : null,
        sort,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.toString(), guests],
  )
  const saved = new Map(state.suppliers.filter((s) => s.catalogueId).map((s) => [s.catalogueId!, s]))
  const mine = state.suppliers.filter((s) => s.category === 'venue')
  const activeCount = councils.length + types.length + (maxKm ? 1 : 0) + (registrar ? 1 : 0) + (fit ? 1 : 0)
  const toggle = (key: 'council' | 'type', id: string) => {
    const cur = list(params.get(key))
    set({ [key]: (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]).join(','), n: null })
  }
  const clear = () => set({ council: null, type: null, km: null, reg: null, fit: null, n: null })

  return (
    <>
      <div className="find-toolbar">
        <div className="seg view-seg" role="tablist" aria-label="Show">
          <button type="button" role="tab" aria-selected={view === 'all'} className={`seg-btn${view === 'all' ? ' on' : ''}`} onClick={() => set({ view: null })}>
            All places
          </button>
          <button type="button" role="tab" aria-selected={view === 'mine'} className={`seg-btn${view === 'mine' ? ' on' : ''}`} onClick={() => set({ view: 'mine' })}>
            Shortlist{mine.length ? ` (${mine.length})` : ''}
          </button>
        </div>
        {view === 'all' && (
          <>
            <button type="button" className={`btn small ${activeCount ? '' : 'ghost'}`} onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
              Filters{activeCount ? ` · ${activeCount}` : ''}
            </button>
            <label className="sort">
              <span className="visually-hidden">Sort</span>
              <select value={sort} onChange={(e) => set({ sort: e.target.value === 'az' ? 'az' : null })} aria-label="Sort">
                <option value="nearest">Nearest</option>
                <option value="az">A–Z</option>
              </select>
            </label>
          </>
        )}
      </div>

      {view === 'all' && activeCount > 0 && (
        <div className="chips active-filters">
          {maxKm && <button type="button" className="chip on" onClick={() => set({ km: null })}>Within {maxKm} km ✕</button>}
          {councils.map((c) => <button key={c} type="button" className="chip on" onClick={() => toggle('council', c)}>{COUNCILS[c].short} ✕</button>)}
          {types.map((t) => <button key={t} type="button" className="chip on" onClick={() => toggle('type', t)}>{venueTypeLabel(t)} ✕</button>)}
          {registrar && <button type="button" className="chip on" onClick={() => set({ reg: null })}>With registrar offices ✕</button>}
          {fit && <button type="button" className="chip on" onClick={() => set({ fit: null })}>Fits {guests} ✕</button>}
          <button type="button" className="text-btn" onClick={clear}>Clear all</button>
        </div>
      )}

      {view === 'mine' ? (
        <ShortlistList suppliers={mine} empty="No venues on your shortlist yet. Tap a place, then “Save to shortlist”." />
      ) : (
        <>
          <p className="tiny result-count" aria-live="polite">
            {results.length} {results.length === 1 ? 'place' : 'places'}{sort === 'nearest' ? `, nearest to ${HOME_BASE.label} first` : ', A–Z'}
          </p>
          {results.length === 0 ? (
            <div className="card empty">
              Nothing matches. <button type="button" className="text-btn" onClick={clear}>Clear filters</button>
            </div>
          ) : (
            <div className="venue-grid">
              {results.slice(0, shown).map((v) => (
                <VenueCard key={v.id} v={v} km={v.km} savedId={saved.get(v.id)?.id} />
              ))}
            </div>
          )}
          {results.length > shown && (
            <button type="button" className="btn secondary more-btn" onClick={() => set({ n: String(shown + PAGE) })}>
              Show more ({results.length - shown} left)
            </button>
          )}
          <p className="tiny source-note">
            Approved places from <a href={DIRECTORY_SOURCE.url} target="_blank" rel="noreferrer">nidirect</a> (page updated{' '}
            {new Date(DIRECTORY_SOURCE.pageUpdated + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, checked{' '}
            {new Date(DIRECTORY_SOURCE.checkedOn + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}).{' '}
            {DIRECTORY_SOURCE.licence} Locations © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors.
            Distances are straight-line from {HOME_BASE.label}. Council-maintained beaches can also be approved — ask the registrar.
          </p>
          <AddSomeone category="venue" />
        </>
      )}

      {filtersOpen && (
        <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="filters-title" onClick={() => setFiltersOpen(false)}>
          <div className="modal filters" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ paddingTop: 0 }}>
              <h2 id="filters-title" style={{ margin: 0 }}>Filters</h2>
              <button type="button" className="text-btn" onClick={clear}>Clear</button>
            </div>
            <fieldset>
              <legend>Distance from {HOME_BASE.label}</legend>
              <div className="chips">
                <button type="button" className={`chip ${!maxKm ? 'on' : ''}`} onClick={() => set({ km: null, n: null })}>Any</button>
                {DISTANCES.map((d) => (
                  <button key={d} type="button" className={`chip ${maxKm === d ? 'on' : ''}`} onClick={() => set({ km: String(d), n: null })}>
                    {d} km
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Council area</legend>
              <div className="chips">
                {COUNCIL_IDS.map((c) => (
                  <button key={c} type="button" aria-pressed={councils.includes(c)} className={`chip ${councils.includes(c) ? 'on' : ''}`} onClick={() => toggle('council', c)}>
                    {COUNCILS[c].short}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Kind of place <span className="tiny">(our best guess from the name)</span></legend>
              <div className="chips">
                {VENUE_TYPES.map((t) => (
                  <button key={t.id} type="button" aria-pressed={types.includes(t.id)} className={`chip ${types.includes(t.id) ? 'on' : ''}`} onClick={() => toggle('type', t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>More</legend>
              <p className="tiny" style={{ marginTop: 0 }}>Every place here is approved for civil marriage and civil partnership ceremonies, so a registrar can marry you there.</p>
              <label className="inline">
                <input type="checkbox" checked={registrar} onChange={(e) => set({ reg: e.target.checked ? '1' : null, n: null })} />
                Include council registrar offices (the simplest, cheapest option)
              </label>
              <label className="inline">
                <input type="checkbox" checked={fit} onChange={(e) => set({ fit: e.target.checked ? '1' : null, n: null })} />
                Fits {guests} day guests — hides places we know are smaller (most don’t publish a capacity)
              </label>
            </fieldset>
            <div className="filters-foot">
              <button type="button" className="btn" onClick={() => setFiltersOpen(false)}>
                Show {results.length} {results.length === 1 ? 'place' : 'places'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function VenueCard({ v, km, savedId }: { v: DirectoryVenue; km: number | null; savedId?: string }) {
  return (
    <Link to={`/find/place/${v.id}`} className="venue-card">
      <VenueArt type={v.type} seed={v.id} photo={v.photo} />
      <div className="venue-card-body">
        <strong>{v.name}</strong>
        <span className="venue-where">{venuePlace(v)}</span>
        <span className="venue-meta">
          {km !== null && <span className="dist">{formatKm(km)}</span>}
          <span>{venueTypeOne(v.type)}</span>
          {v.capacity && <span>Up to {v.capacity}</span>}
        </span>
        <span className="venue-badges">
          {savedId && <span className="pill ok">On shortlist</span>}
          {v.checked && <span className="pill neutral">Checked facts</span>}
        </span>
      </div>
    </Link>
  )
}

// ---- shortlist & other categories ------------------------------------

function ShortlistList({ suppliers, empty }: { suppliers: Supplier[]; empty: string }) {
  if (!suppliers.length) return <div className="card empty">{empty}</div>
  return (
    <div className="venue-grid">
      {suppliers.map((s) => {
        const dir = s.catalogueId ? DIRECTORY.find((d) => d.id === s.catalogueId) : undefined
        return (
          <Link key={s.id} to={`/find/${s.id}`} className="venue-card">
            {s.category === 'venue' ? <VenueArt type={dir?.type ?? 'other'} seed={s.id} photo={dir?.photo} /> : <CategoryArt category={s.category} />}
            <div className="venue-card-body">
              <strong>{s.name}</strong>
              <span className="venue-where">{s.area || dir?.town || 'Area not set'}</span>
              <span className="venue-badges"><span className="pill" style={{ textTransform: 'capitalize' }}>{s.status}</span></span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function OtherFinder({ category, q }: { category: SupplierCategory; q: string }) {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const area = state.profile.area || 'Belfast Antrim Newtownabbey'
  const urls = searchUrls(category, area)
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const match = (text: string) => words.every((w) => text.toLowerCase().includes(w))
  const catalog = CATALOGUE.filter((c) => c.category === category && match(`${c.name} ${c.area} ${c.note ?? ''}`))
  const mine = state.suppliers.filter((s) => s.category === category && match(`${s.name} ${s.area}`))

  const shortlist = (id: string) => {
    const item = CATALOGUE.find((c) => c.id === id)
    if (!item) return
    // Checked facts stay with the catalogue entry (shown read-only on the detail page), not in the couple's notes.
    const supplier = newSupplier({ catalogueId: item.id, name: item.name, category: item.category, area: item.area, website: item.website, phone: item.phone ?? '', notes: '' })
    dispatch({ type: 'addSupplier', supplier })
    navigate(`/find/${supplier.id}`)
  }

  return (
    <>
      {catalog.length > 0 && (
        <section>
          <div className="sec-head"><h2>Starter list</h2></div>
          <div className="venue-grid">
            {catalog.map((item) => {
              const saved = state.suppliers.find((s) => s.catalogueId === item.id)
              return (
                <article key={item.id} className="venue-card">
                  <CategoryArt category={item.category} />
                  <div className="venue-card-body">
                    <strong>{item.name}</strong>
                    <span className="venue-where">{item.area}</span>
                    {item.note && <span className="venue-note">{item.note}</span>}
                    <span className="venue-badges">
                      {saved ? (
                        <Link className="btn small" to={`/find/${saved.id}`}>Open</Link>
                      ) : (
                        <button className="btn small" type="button" onClick={() => shortlist(item.id)}>Save to shortlist</button>
                      )}
                      {item.website && <a className="text-btn" href={item.website} target="_blank" rel="noreferrer">Website</a>}
                      <a className="text-btn" href={item.sourceUrl} target="_blank" rel="noreferrer">Source</a>
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
      <section>
        <div className="sec-head"><h2>Your {categoryLabel(category).toLowerCase()} shortlist</h2></div>
        <ShortlistList suppliers={mine} empty="Nobody here yet. Save a starter, add someone you know, or search the web below." />
      </section>
      <AddSomeone category={category} />
      <section className="card">
        <h2>Search the web for {categoryPlural(category)}</h2>
        <p className="tiny">Opens in a new tab, already searched for “{categoryLabel(category).toLowerCase()} {area}”.</p>
        <div className="btn-row">
          <a className="btn" href={urls.google} target="_blank" rel="noreferrer">Google</a>
          <a className="btn secondary" href={urls.hitched} target="_blank" rel="noreferrer">Hitched</a>
          <a className="btn secondary" href={urls.bridebook} target="_blank" rel="noreferrer">Bridebook</a>
          <a className="btn secondary" href={urls.maps} target="_blank" rel="noreferrer">Google Maps</a>
        </div>
      </section>
    </>
  )
}

function AddSomeone({ category }: { category: SupplierCategory }) {
  const { dispatch } = useStore()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [place, setPlace] = useState('')
  return (
    <section className="card add-someone">
      <div className="row" style={{ paddingTop: 0 }}>
        <div>
          <h2 style={{ margin: 0 }}>Know someone already?</h2>
          <p className="tiny" style={{ margin: '4px 0 0' }}>Add a {category === 'venue' ? 'venue' : categoryLabel(category).toLowerCase()} that isn’t listed here.</p>
        </div>
        <button className="btn ghost small" type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>Add someone</button>
      </div>
      {adding && (
        <div className="grid-2" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Website</span>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
          <label className="field">
            <span>Town or area (optional)</span>
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Ballymena" />
          </label>
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (!name.trim()) return
              // Only what they typed: a default area would pick the wrong council fees.
              const supplier = newSupplier({ name: name.trim(), category, website: website.trim(), area: place.trim() })
              dispatch({ type: 'addSupplier', supplier })
              setName(''); setWebsite(''); setPlace(''); setAdding(false)
              navigate(`/find/${supplier.id}`)
            }}
          >
            Save to shortlist
          </button>
        </div>
      )}
    </section>
  )
}
