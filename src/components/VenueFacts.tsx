import { useState } from 'react'
import { COUNCILS, type FeeBand } from '../data/legal'
import { venueFee } from '../data/venueFee'
import { DIRECTORY_SOURCE, HOME_BASE, directionsUrl, distanceKm, formatKm, osmEmbedUrl, osmLink, venueTypeOne, type DirectoryVenue } from '../data/venues'
import { gbp as formatMoney } from '../lib/money'

const longDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`

/** Read-only, checked facts about a directory venue — kept apart from the couple's own notes. */
export function VenueFactsCard({ v }: { v: DirectoryVenue }) {
  const km = distanceKm(v)
  return (
    <section className="card facts-card" aria-labelledby={`facts-${v.id}`}>
      <div className="sec-head">
        <h2 id={`facts-${v.id}`}>Facts</h2>
        <span className="pill neutral">Read-only</span>
      </div>
      <dl className="facts">
        {v.address && (
          <>
            <dt>Address</dt>
            <dd>{[v.address, v.town, v.postcode].filter(Boolean).join(', ')}</dd>
          </>
        )}
        {!v.address && v.town && (
          <>
            <dt>Town</dt>
            <dd>{v.town}{v.postcode ? `, ${v.postcode}` : ''}</dd>
          </>
        )}
        <dt>Council</dt>
        <dd>{COUNCILS[v.council].name}</dd>
        {km !== null && (
          <>
            <dt>Distance</dt>
            <dd>{formatKm(km)} from {HOME_BASE.label} (straight line)</dd>
          </>
        )}
        {v.phone && (
          <>
            <dt>Phone</dt>
            <dd><a href={telHref(v.phone)}>{v.phone}</a></dd>
          </>
        )}
        <dt>Ceremonies</dt>
        <dd>{v.kind === 'registrar' ? 'Council registrar office' : 'Approved for civil marriage and civil partnership'}</dd>
        <dt>Kind of place</dt>
        <dd>{venueTypeOne(v.type)} <span className="tiny">(our guess from the name)</span></dd>
        {v.capacity && (
          <>
            <dt>Capacity</dt>
            <dd>Up to {v.capacity} (from the checked source below)</dd>
          </>
        )}
      </dl>
      {v.facts && (
        <div className="checked-facts">
          <p>{v.facts}</p>
          {v.factsSource && (
            <p className="tiny">
              Checked against <a href={v.factsSource.url} target="_blank" rel="noreferrer">{v.factsSource.label}</a>
            </p>
          )}
        </div>
      )}
      <p className="tiny source-note">
        Listed by <a href={DIRECTORY_SOURCE.url} target="_blank" rel="noreferrer">nidirect</a> (page updated {longDate(DIRECTORY_SOURCE.pageUpdated)}; checked {longDate(DIRECTORY_SOURCE.checkedOn)}).{' '}
        <a href={DIRECTORY_SOURCE.licenceUrl} target="_blank" rel="noreferrer">{DIRECTORY_SOURCE.licence}</a> Where nidirect gives only the town, the street and postcode come from © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors (ODbL). Venues change hands and close — confirm with the venue and registrar before booking.
      </p>
    </section>
  )
}

/** Free OpenStreetMap embed, only loaded when the card scrolls into view. */
export function VenueMapCard({ v }: { v: DirectoryVenue }) {
  const [show, setShow] = useState(false)
  if (v.lat === null || v.lng === null)
    return (
      <section className="card">
        <h2>Map</h2>
        <p className="tiny">We couldn’t pin this one. <a href={directionsUrl(v)} target="_blank" rel="noreferrer">Search for it on Google Maps</a>.</p>
      </section>
    )
  const approx = v.geo === 'town'
  return (
    <section className="card map-card">
      <div className="sec-head">
        <h2>Map</h2>
        {approx && <span className="pill warn">Approximate</span>}
      </div>
      <div className="map-frame">
        {show ? (
          <iframe title={`Map of ${v.name}`} src={osmEmbedUrl(v.lat, v.lng, approx ? 0.03 : 0.008)} loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <button type="button" className="map-placeholder" onClick={() => setShow(true)}>
            <span>Show map</span>
            <span className="tiny">Loads OpenStreetMap</span>
          </button>
        )}
      </div>
      <p className="tiny">
        {approx ? `Pinned to ${v.town || 'the town'}, not the venue itself. ` : v.geo === 'postcode' ? 'Pinned to the street address, close to the venue. ' : ''}
        <a href={osmLink(v.lat, v.lng)} target="_blank" rel="noreferrer">Larger map</a>
        {' · '}
        <a href={directionsUrl(v)} target="_blank" rel="noreferrer">Directions</a>
        {' · '}Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
      </p>
    </section>
  )
}

function gap(label: string) {
  const why = label.split(' · ')[1] ?? 'fee not published'
  return `${why[0].toUpperCase()}${why.slice(1)} online.`
}

function holidayText(b: FeeBand) {
  if (b.holiday !== null) return formatMoney(b.holiday)
  return b.noHolidays ? 'No ceremonies' : 'Ask the registrar'
}

/** The registrar fee for this venue's own council. */
export function CouncilFeesCard({ v }: { v: Pick<DirectoryVenue, 'id' | 'name' | 'council'> & { area?: string } }) {
  const fee = venueFee({ catalogueId: v.id, name: v.name, area: v.area ?? '', council: undefined })
  const c = COUNCILS[fee.council ?? v.council]
  const b = fee.band
  return (
    <section className="card fees-card">
      <h2>Registrar fees</h2>
      <p className="tiny" style={{ marginTop: 0 }}>{c.name} — what the registrar charges to marry you here. The venue’s own hire is extra.</p>
      {b ? (
        <>
          <div className="fee-grid">
            <div><span className="tiny">Mon–Fri</span><strong>{formatMoney(b.weekday)}</strong></div>
            <div><span className="tiny">Saturday</span><strong>{formatMoney(b.saturday)}</strong></div>
            <div><span className="tiny">{b.noSundays ? 'Bank holiday' : 'Sun / bank hol.'}</span><strong>{holidayText(b)}</strong></div>
          </div>
          <p className="tiny">{b.noSundays ? 'No Sunday ceremonies. ' : ''}{b.note}</p>
        </>
      ) : (
        <p>
          {gap(fee.label)}{' '}
          Call the registrar on <a href={telHref(c.registrarPhone)}>{c.registrarPhone}</a> for the current fee.
        </p>
      )}
      <p className="tiny">
        Source: <a href={c.sourceUrl} target="_blank" rel="noreferrer">{c.sourceLabel}</a> · Registrar <a href={telHref(c.registrarPhone)}>{c.registrarPhone}</a>
      </p>
    </section>
  )
}
