import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CATALOGUE } from '../data/catalogue'
import { CATEGORIES, categoryLabel } from '../data/categories'
import { searchUrls } from '../data/searchLinks'
import { newSupplier, useStore } from '../state/store'
import type { SupplierCategory } from '../types'
import { CategoryIcon } from '../components/Icons'

const VALID = new Set<string>(CATEGORIES.map((c) => c.id))

export function Suppliers() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const raw = params.get('cat') || 'venue'
  const category = (VALID.has(raw) ? raw : 'venue') as SupplierCategory
  const setCategory = (id: SupplierCategory) => setParams({ cat: id }, { replace: true })
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const area = useMemo(() => state.profile.area || 'Belfast Antrim Newtownabbey', [state.profile.area])
  const urls = searchUrls(category, area)
  const catalog = CATALOGUE.filter((c) => c.category === category)
  const mine = state.suppliers.filter((s) => s.category === category)

  const addFromCatalogue = (id: string) => {
    const item = CATALOGUE.find((c) => c.id === id)
    if (!item) return
    const supplier = newSupplier({
      catalogueId: item.id,
      name: item.name,
      category: item.category,
      area: item.area,
      website: item.website,
      phone: item.phone ?? '',
      notes: item.note ?? '',
    })
    dispatch({ type: 'addSupplier', supplier })
    navigate(`/find/${supplier.id}`)
  }

  return (
    <div className="grid">
      <header className="page-head">
        <div className="kicker">Find</div>
        <h1>Discover venues and suppliers</h1>
        <p>
          Start with places we have checked from public official pages, then search more widely or add someone you already like.
          Nothing here is an advert — and the app never emails anyone for you.
        </p>
      </header>

      <div className="chips">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`chip ${category === c.id ? 'on' : ''}`} type="button" onClick={() => setCategory(c.id)}>
            <CategoryIcon category={c.id} />
            {c.label}
          </button>
        ))}
      </div>

      <section className="card">
        <h2>Search the web for {categoryLabel(category).toLowerCase()}</h2>
        <p className="tiny">Opens in a new tab, already searched for “{categoryLabel(category).toLowerCase()} {area}”.</p>
        <div className="btn-row">
          <a className="btn" href={urls.google} target="_blank" rel="noreferrer">Google</a>
          <a className="btn secondary" href={urls.hitched} target="_blank" rel="noreferrer">Hitched</a>
          <a className="btn secondary" href={urls.bridebook} target="_blank" rel="noreferrer">Bridebook</a>
          <a className="btn secondary" href={urls.maps} target="_blank" rel="noreferrer">Google Maps</a>
        </div>
      </section>

      {catalog.length > 0 && (
        <section className="card">
          <h2>Starter list</h2>
          <p>Checked against a public official page. We only store the facts we verified.</p>
          <div className="supplier-list">
            {catalog.map((item) => {
              const saved = state.suppliers.find((s) => s.catalogueId === item.id)
              return (
                <article key={item.id} className="supplier-card">
                  <div className="supplier-cover" data-cat={item.category}>
                    <CategoryIcon category={item.category} />
                  </div>
                  <div className="supplier-body">
                    <strong>{item.name}</strong>
                    <div className="tiny">{item.area}{item.phone ? ` · ${item.phone}` : ''}</div>
                    {item.note && <p className="tiny" style={{ margin: '4px 0 0' }}>{item.note}</p>}
                    <div className="tiny meta-line">
                      <a href={item.website} target="_blank" rel="noreferrer">Website</a>
                      {' · '}
                      Source: <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.source}</a>
                    </div>
                  </div>
                  {saved ? (
                    <Link className="btn small" to={`/find/${saved.id}`}>Open</Link>
                  ) : (
                    <button className="btn small" type="button" onClick={() => addFromCatalogue(item.id)}>
                      Shortlist
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      )}

      <section className="card">
        <div className="row" style={{ paddingTop: 0 }}>
          <h2>Your {categoryLabel(category).toLowerCase()} shortlist</h2>
          <button className="btn ghost small" type="button" onClick={() => setAdding((v) => !v)}>Add someone</button>
        </div>
        {adding && (
          <div className="grid-2">
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Website</span>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
            <button
              className="btn"
              type="button"
              onClick={() => {
                if (!name.trim()) return
                const supplier = newSupplier({ name: name.trim(), category, website, area: state.profile.area })
                dispatch({ type: 'addSupplier', supplier })
                setName(''); setWebsite(''); setAdding(false)
                navigate(`/find/${supplier.id}`)
              }}
            >
              Save to shortlist
            </button>
          </div>
        )}
        {mine.length === 0 ? (
          <div className="empty">Nobody in this category yet. Shortlist a starter or add your own.</div>
        ) : (
          <div className="supplier-list">
            {mine.map((s) => (
              <Link key={s.id} to={`/find/${s.id}`} className="supplier-card">
                <div className="supplier-cover" data-cat={s.category}>
                  <CategoryIcon category={s.category} />
                </div>
                <div className="supplier-body">
                  <strong>{s.name}</strong>
                  <div className="tiny">{s.area}</div>
                </div>
                <span className="pill">{s.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
