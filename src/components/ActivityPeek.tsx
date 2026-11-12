import { Link } from 'react-router-dom'
import { partnerName, useMe } from '../lib/me'
import { useStore } from '../state/store'
import { useActivity } from '../sync/activityLog'
import { IconBell, IconChevron, IconClock, IconTable } from './Icons'

/** Home card: what the partner changed since this phone last looked. Hidden when nothing is new. */
export function ActivityPeek() {
  const { state } = useStore()
  const [me] = useMe()
  const { log, unseen } = useActivity()
  if (!unseen) return null
  const who = partnerName(state.profile, me)
  const fresh = log.slice(0, Math.min(unseen, 3))
  return (
    <Link to="/activity" className="card activity-peek" data-area="activity">
      <div className="ap-head">
        <span className="ap-icon"><IconBell /></span>
        <div>
          <strong>Since you last looked</strong>
          <span className="tiny">{who} made {unseen === 1 ? 'a change' : `${unseen} changes`}</span>
        </div>
        <IconChevron className="ap-go" aria-hidden="true" />
      </div>
      <ul>
        {fresh.map((x) => (
          <li key={x.id}>{x.text.charAt(0).toUpperCase() + x.text.slice(1)}</li>
        ))}
        {unseen > fresh.length && <li className="tiny">and {unseen - fresh.length} more</li>}
      </ul>
    </Link>
  )
}

/** Home shortcuts to the wedding-day tools (phones have no sidebar). */
export function DayTools() {
  return (
    <section className="day-tools" data-area="tools">
      <div className="sec-head">
        <h2>On the day</h2>
      </div>
      <div className="day-tools-row">
        <Link className="card day-tool" to="/run-sheet">
          <IconClock />
          <span><strong>Run sheet</strong><small>Timeline, contacts, print</small></span>
        </Link>
        <Link className="card day-tool" to="/seating">
          <IconTable />
          <span><strong>Seating plan</strong><small>Tables and who sits where</small></span>
        </Link>
      </div>
    </section>
  )
}
