import { useState } from 'react'
import { Link } from 'react-router-dom'
import { STAGES } from '../data/checklist'
import { formatShort } from '../data/legal'
import { useStore } from '../state/store'
import { IconCalendar, IconChevron, StageIcon } from '../components/Icons'

export function Checklist() {
  const { state, tasks, dispatch } = useStore()
  const [title, setTitle] = useState('')
  const dated = Boolean(state.profile.date)

  return (
    <div className="grid">
      <header className="page-head">
        <div className="kicker">{dated ? 'Dated plan' : 'Staged plan'}</div>
        <h1>{dated ? 'Your deadlines' : 'What to do before you have a date'}</h1>
        <p>
          {dated
            ? 'Now that a date is set, legal steps sit on the calendar — including Northern Ireland notice and the marriage schedule.'
            : 'Until you choose a date, the plan stays in stages so you know what to do first. Compare dates whenever you are ready; the list will grow real deadlines automatically.'}
        </p>
      </header>

      <Link to="/dates" className="card dates-cta">
        <div className="well">
          <IconCalendar />
        </div>
        <div className="grow">
          <h2>Compare dates</h2>
          <p>Weigh up Saturdays, weekdays, holidays and registrar fees.</p>
        </div>
        <span className="text-btn">
          Open <IconChevron style={{ width: 14, height: 14, verticalAlign: '-2px' }} />
        </span>
      </Link>

      {STAGES.map((stage) => {
        const items = tasks.filter((t) => t.stage === stage.id)
        if (!items.length) return null
        const done = items.filter((t) => t.done).length
        return (
          <section className="card" key={stage.id}>
            <div className="row" style={{ paddingTop: 0, alignItems: 'center' }}>
              <div className="well">
                <StageIcon stage={stage.id} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0 }}>{stage.title}</h2>
                <p style={{ margin: '4px 0 0' }}>{stage.blurb}</p>
              </div>
              <span className="pill">
                {done}/{items.length}
              </span>
            </div>
            <div className="progress" style={{ margin: '4px 0 12px' }}>
              <div style={{ width: `${(done / items.length) * 100}%` }} />
            </div>
            {items.map((t) => (
              <label key={t.key} className="row" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={!!t.done} onChange={() => dispatch({ type: 'toggleTask', key: t.key })} />
                <div style={{ flex: 1 }}>
                  <strong>{t.title}</strong>
                  {t.dueDate && (
                    <div className="tiny">
                      Due {formatShort(t.dueDate)} {t.legal && <span className="pill warn">Legal</span>}
                    </div>
                  )}
                  <p style={{ margin: '6px 0 0' }}>{t.body}</p>
                  {t.officialUrl && (
                    <a href={t.officialUrl} target="_blank" rel="noreferrer">
                      {t.officialLabel || 'Official information'}
                    </a>
                  )}
                </div>
              </label>
            ))}
          </section>
        )
      })}

      <section className="card">
        <h2>Add your own task</h2>
        <div className="btn-row">
          <input
            style={{ flex: 1, minWidth: 180 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Ask auntie about family tartan"
          />
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (!title.trim()) return
              dispatch({ type: 'addCustomTask', title: title.trim(), stage: 'details' })
              setTitle('')
            }}
          >
            Add
          </button>
        </div>
      </section>
    </div>
  )
}
