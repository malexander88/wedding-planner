import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { directoryVenue, directionsUrl, distanceKm, formatKm, venuePlace, venueTypeOne, type DirectoryVenue } from '../data/venues'
import { findPlaceId, placeDetails, placesEnabled, type PlaceDetails } from '../lib/places'
import { newSupplier, useStore } from '../state/store'
import { IconBack } from '../components/Icons'
import { VenueArt } from '../components/VenueArt'
import { CouncilFeesCard, VenueFactsCard, VenueMapCard } from '../components/VenueFacts'

export function VenueDetail() {
  const { venueId } = useParams()
  const v = venueId ? directoryVenue(venueId) : undefined
  if (!v)
    return (
      <div className="grid">
        <Link className="text-btn back-link" to="/find"><IconBack /> Find</Link>
        <div className="card empty">We couldn’t find that venue. It may have been removed from the approved list.</div>
      </div>
    )
  return <VenuePage v={v} />
}

function VenuePage({ v }: { v: DirectoryVenue }) {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const saved = state.suppliers.find((s) => s.catalogueId === v.id)
  const km = distanceKm(v)

  const save = () => {
    if (saved) return saved.id
    const supplier = newSupplier({
      catalogueId: v.id,
      name: v.name,
      category: 'venue',
      area: v.town,
      council: v.council,
      website: v.website ?? '',
      phone: v.phone,
      notes: '', // checked facts live in the read-only Facts card, not in the couple's notes
    })
    dispatch({ type: 'addSupplier', supplier })
    return supplier.id
  }

  return (
    <div className="grid venue-detail">
      <Link className="text-btn back-link" to="/find?cat=venue"><IconBack /> All venues</Link>
      <div className="venue-hero">
        <VenueArt type={v.type} seed={v.id} photo={v.photo} alt="" className="hero-art" />
        <div className="venue-hero-text">
          <h1>{v.name}</h1>
          <p className="venue-where">
            {venuePlace(v)}
            {km !== null && <> · {formatKm(km)}</>}
          </p>
          <div className="chips">
            <span className="pill ok">{v.kind === 'registrar' ? 'Registrar office' : 'Approved for ceremonies'}</span>
            <span className="pill neutral">{venueTypeOne(v.type)}</span>
            {v.checked && <span className="pill neutral">Checked facts</span>}
          </div>
        </div>
      </div>

      <div className="venue-actions">
        {saved ? (
          <Link className="btn" to={`/find/${saved.id}`}>On your shortlist · Open</Link>
        ) : (
          <button className="btn" type="button" onClick={() => save()}>Save to shortlist</button>
        )}
        <button className="btn secondary" type="button" onClick={() => navigate(`/find/${save()}?enquire=1`)}>
          Draft an enquiry
        </button>
        {v.phone && <a className="btn secondary" href={`tel:${v.phone.replace(/[^\d+]/g, '')}`}>Call</a>}
        <a className="btn secondary" href={directionsUrl(v)} target="_blank" rel="noreferrer">Directions</a>
        {v.website && <a className="btn secondary" href={v.website} target="_blank" rel="noreferrer">Website</a>}
      </div>

      <div className="venue-cols">
        <div className="grid">
          <VenueFactsCard v={v} />
          {placesEnabled() && <GoogleCard v={v} placeId={saved?.placeId} onId={(id) => saved && dispatch({ type: 'updateSupplier', id: saved.id, patch: { placeId: id } })} />}
        </div>
        <div className="grid">
          <CouncilFeesCard v={{ ...v, area: v.town }} />
          <VenueMapCard v={v} />
        </div>
      </div>
    </div>
  )
}

/** Live Google details (only when the Places proxy is switched on). Shown fresh, never stored. */
export function GoogleCard({ v, placeId, onId }: { v: Pick<DirectoryVenue, 'name' | 'town'>; placeId?: string; onId?: (id: string) => void }) {
  const [d, setD] = useState<PlaceDetails | null | 'loading'>('loading')
  useEffect(() => {
    let live = true
    ;(async () => {
      const id = placeId ?? (await findPlaceId(v.name, v.town))
      if (id && id !== placeId) onId?.(id)
      const det = id ? await placeDetails(id) : null
      if (live) setD(det)
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, v.name, v.town])
  if (d === 'loading') return <section className="card"><p className="tiny">Checking Google…</p></section>
  if (!d) return null
  return (
    <section className="card google-card">
      <h2>From Google</h2>
      {d.closed && <p className="pill warn">Google lists this place as permanently closed — check before you go further.</p>}
      {d.photo && (
        <figure>
          <img src={d.photo.url} alt={`${d.name}`} loading="lazy" />
          <figcaption className="tiny">Photo: {d.photo.attributions.map((a, i) => <span key={i}>{a.uri ? <a href={a.uri} target="_blank" rel="noreferrer">{a.name}</a> : a.name}</span>)}</figcaption>
        </figure>
      )}
      <dl className="facts">
        {d.rating !== undefined && (<><dt>Rating</dt><dd>{d.rating.toFixed(1)} ★ ({d.ratingCount ?? 0} reviews)</dd></>)}
        {d.address && (<><dt>Address</dt><dd>{d.address}</dd></>)}
        {d.phone && (<><dt>Phone</dt><dd>{d.phone}</dd></>)}
        {d.website && (<><dt>Website</dt><dd><a href={d.website} target="_blank" rel="noreferrer">{d.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></dd></>)}
      </dl>
      <p className="tiny google-attr">
        {d.mapsUrl && <><a href={d.mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps</a> · </>}
        <span translate="no">Google Maps</span>
      </p>
    </section>
  )
}
