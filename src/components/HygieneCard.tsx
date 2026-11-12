import { RATING_TEXT, type HygieneQuery } from '../lib/hygiene'
import { formatShort } from '../data/legal'
import { useHygiene, type HygieneState } from '../lib/useHygiene'

export function HygieneBadge({ state, compact }: { state: HygieneState | null; compact?: boolean }) {
  if (!state || state.status === 'loading') return compact ? <span className="tiny">…</span> : null
  if (state.status !== 'match') return compact ? <span className="tiny muted">Not found</span> : null
  const r = state.match.rating
  const numeric = /^[0-5]$/.test(r)
  return (
    <span className={`fhrs-badge${numeric ? ` fhrs-${r}` : ' fhrs-other'}`} title={`Food hygiene rating: ${RATING_TEXT[r] ?? r}`}>
      {numeric ? (
        <>
          <b>{r}</b>
          <span>/5</span>
        </>
      ) : (
        <span>{RATING_TEXT[r] ?? r}</span>
      )}
    </span>
  )
}

export const FsaCredit = () => (
  <p className="tiny fhrs-credit">
    Food hygiene rating from the{' '}
    <a href="https://ratings.food.gov.uk/" target="_blank" rel="noreferrer">
      Food Standards Agency
    </a>
    , shared under the Open Government Licence. It covers the kitchen, not the venue as a whole.
  </p>
)

/** Food hygiene rating for a venue or caterer, when the FSA lists a confident match. */
export function HygieneCard({ query, label }: { query: HygieneQuery; label: string }) {
  const state = useHygiene(query)
  if (!state) return null
  return (
    <section className="card hygiene-card" aria-labelledby="fhrs-title">
      <div className="sec-head">
        <h2 id="fhrs-title">Food hygiene</h2>
        {state.status === 'match' && <HygieneBadge state={state} />}
      </div>
      {state.status === 'loading' && <p className="tiny">Checking the FSA’s ratings…</p>}
      {state.status === 'match' && (
        <>
          <p className="fhrs-text">
            <strong>{RATING_TEXT[state.match.rating] ?? state.match.rating}</strong>
            {state.match.ratedOn && <> · inspected {formatShort(state.match.ratedOn)}</>}
            {state.match.pending && <> · a new rating is pending</>}
          </p>
          <p className="tiny">
            Listed as <strong>{state.match.name}</strong>, {state.match.address}
            {state.match.authority ? ` (${state.match.authority})` : ''}. Not the right place? Check on the FSA site.
          </p>
          <a className="text-btn" href={state.match.url} target="_blank" rel="noreferrer">
            See the rating on ratings.food.gov.uk
          </a>
        </>
      )}
      {state.status === 'none' && (
        <p className="tiny">
          No food business listed under “{label}” nearby. Many venues use outside caterers — ask whose kitchen it is, then check{' '}
          <a href="https://ratings.food.gov.uk/" target="_blank" rel="noreferrer">ratings.food.gov.uk</a>.
        </p>
      )}
      {state.status === 'error' && <p className="tiny">Couldn’t reach the FSA just now — try again later.</p>}
      <FsaCredit />
    </section>
  )
}
