import { Link } from 'react-router-dom'
import { currentStage, STAGES } from '../data/checklist'
import { daysUntil, formatLong } from '../data/legal'
import { totals } from '../data/budgetSeeds'
import { gbp } from '../lib/money'
import { useStore } from '../state/store'
import {
  CategoryIcon,
  IconBloom,
  IconCake,
  IconCalendar,
  IconCamera,
  IconChevron,
  IconClipboard,
  IconGuests,
  IconHome,
  IconLeaf,
  IconMusic,
  IconPalette,
  IconRings,
  IconSparkle,
  StageIcon,
} from '../components/Icons'

const FEATURED = [
  { cat: 'venue', label: 'Venue' },
  { cat: 'photographer', label: 'Photo' },
  { cat: 'florist', label: 'Flowers' },
  { cat: 'cake', label: 'Cake' },
  { cat: 'entertainment', label: 'Music' },
] as const

function taskIcon(stage: string, title: string) {
  const t = title.toLowerCase()
  if (t.includes('ceremon') || t.includes('officiant') || t.includes('notice')) return <IconRings />
  if (t.includes('style') || t.includes('feel') || t.includes('vision')) return <IconPalette />
  if (t.includes('season') || t.includes('date')) return <IconLeaf />
  if (t.includes('budget') || t.includes('insurance')) return <IconClipboard />
  if (t.includes('guest') || t.includes('household') || t.includes('invit') || t.includes('witness')) return <IconGuests />
  if (t.includes('photo') || t.includes('video')) return <IconCamera />
  if (t.includes('flower') || t.includes('florist')) return <IconBloom />
  if (t.includes('cake')) return <IconCake />
  if (t.includes('music') || t.includes('band') || t.includes('dj')) return <IconMusic />
  if (t.includes('outfit')) return <IconSparkle />
  if (t.includes('calendar') || t.includes('appointment')) return <IconCalendar />
  if (stage === 'venue') return <IconHome />
  return <StageIcon stage={stage} />
}

export function Home() {
  const { state, tasks, dispatch } = useStore()
  const p = state.profile
  const a = p.partnerAName || 'Partner one'
  const b = p.partnerBName || 'Partner two'
  const stageId = currentStage(state)
  const stage = STAGES.find((s) => s.id === stageId) ?? STAGES[0]
  const stageTasks = tasks.filter((t) => t.stage === stageId)
  const stageDone = stageTasks.filter((t) => t.done).length
  const stageTotal = stageTasks.length || 1
  const pct = stageDone / stageTotal
  const circ = 2 * Math.PI * 34
  const dash = `${(pct * circ).toFixed(2)} ${(circ).toFixed(2)}`
  const nextTasks = tasks.filter((t) => !t.done).slice(0, 3)
  const money = totals(state)
  const spend = money.quoted || p.totalBudget
  const barPct = Math.min(100, ((money.quoted || 0) / Math.max(p.totalBudget, 1)) * 100)
  const hero = `${import.meta.env.BASE_URL}images/hero.webp`
  const place = (p.area || 'Northern Ireland').split(/[,&]/)[0].trim()

  return (
    <div className="grid">
      <section className="hero-photo">
        <img src={hero} alt="" />
        <div className="tint" />
        <div className="scrim" />
        <div className="hero-copy">
          <h1>
            {a} <em>&amp;</em> {b}
          </h1>
          <div className="flourish">
            <i />
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <path d="M6 0c.2 2.4 1.6 4.4 3.6 5.2C7.6 6 6.2 8 6 10.4 5.8 8 4.4 6 2.4 5.2 4.4 4.4 5.8 2.4 6 0z" />
            </svg>
            <i />
          </div>
          <p>
            {p.date
              ? `${formatLong(p.date)} · ${daysUntil(p.date) >= 0 ? `${daysUntil(p.date)} days to go` : 'That’s your wedding day'}`
              : `${place} · a date still to choose`}
          </p>
        </div>
      </section>

      <section className="card progress-card">
        <div className="ring-wrap">
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle className="track" cx="40" cy="40" r="34" />
            <circle className="fill" cx="40" cy="40" r="34" style={{ strokeDasharray: dash }} />
          </svg>
          <div className="ring-label">
            <b>{stageDone}</b>
            <span>of {stageTotal}</span>
          </div>
        </div>
        <div className="progress-copy">
          <div className="kicker">Planning stage</div>
          <h2>{stage.title}</h2>
          <p>
            {stageDone} of {stageTotal} done
          </p>
        </div>
        <Link className="btn small" to="/plan">
          Continue
          <IconChevron />
        </Link>
      </section>

      <section className="card">
        <div className="sec-head">
          <h2>Next up</h2>
          <Link className="text-btn" to="/plan">
            See all
          </Link>
        </div>
        {nextTasks.length === 0 ? (
          <p>Everything on the list is ticked. Enjoy that for a moment.</p>
        ) : (
          <div className="list">
            {nextTasks.map((t) => (
              <label key={t.key} className="task">
                <div className="well">{taskIcon(t.stage, t.title)}</div>
                <div className="task-copy">
                  <strong>{t.title}</strong>
                  <span>{t.dueDate ? `Due ${formatLong(t.dueDate)}` : t.body}</span>
                </div>
                <input type="checkbox" checked={!!t.done} onChange={() => dispatch({ type: 'toggleTask', key: t.key })} />
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="budget-glance">
          <div>
            <h2 style={{ margin: 0 }}>Budget</h2>
            <div className="tiny" style={{ marginTop: 4 }}>
              {money.quoted ? 'Quoted so far' : money.estimate ? 'Nothing booked yet' : 'A working figure'}
            </div>
          </div>
          <div className="amount">
            {gbp(spend)}
            <small>{money.quoted ? `of ${gbp(p.totalBudget)} working budget` : `${gbp(money.estimate)} estimated`}</small>
          </div>
        </div>
        <div className="bar-row">
          <div className="progress" role="img" aria-label={`${Math.round(barPct)} percent of working budget`}>
            <div style={{ width: `${barPct}%` }} />
          </div>
          <span className="bar-pct">{Math.round(barPct)}%</span>
        </div>
      </section>

      <section>
        <div className="sec-head">
          <h2>Find suppliers</h2>
          <Link className="text-btn" to="/find">
            See all
          </Link>
        </div>
        <div className="chips scroll">
          {FEATURED.map((c) => (
            <Link key={c.cat} className={`chip${c.cat === 'venue' ? ' on' : ''}`} to={`/find?cat=${c.cat}`}>
              <CategoryIcon category={c.cat} />
              {c.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
