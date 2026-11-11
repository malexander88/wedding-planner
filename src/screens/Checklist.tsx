import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { STAGES } from '../data/checklist'
import { formatShort } from '../data/legal'
import {
  assigneeName,
  catchUpBefore,
  GROUPS,
  groupOf,
  groupTasks,
  localToday,
  matchesFilter,
  movePatch,
  sortTasks,
  type PlanFilter,
  type PlanGroup,
  type PlanView,
} from '../data/plan'
import { useStore } from '../state/store'
import { IconCalendar, IconChevron, StageIcon } from '../components/Icons'
import { useDetailSummary, useTaskSheet } from '../components/TaskDetailsSheet'
import { TaskEditSheet } from '../components/TaskEditSheet'
import { CUSTOM_TEMPLATE_CHOICES, TEMPLATES } from '../data/taskTemplates'
import type { Assignee, PlanTask, Task, TemplateId } from '../types'

const ME_KEY = 'wp-me'
function useMe(): ['a' | 'b', (m: 'a' | 'b') => void] {
  const [me, setMe] = useState<'a' | 'b'>(() => {
    try {
      return localStorage.getItem(ME_KEY) === 'b' ? 'b' : 'a'
    } catch {
      return 'a'
    }
  })
  return [
    me,
    (m) => {
      setMe(m)
      try {
        localStorage.setItem(ME_KEY, m)
      } catch {
        /* private mode: fine for this session */
      }
    },
  ]
}

const FILTERS: { id: PlanFilter; label: (n: { a: string; b: string }, me: 'a' | 'b') => string }[] = [
  { id: 'all', label: () => 'All' },
  { id: 'mine', label: () => 'Mine' },
  { id: 'partner', label: (n, me) => `${me === 'a' ? n.b : n.a}'s` },
  { id: 'overdue', label: () => 'Overdue' },
  { id: 'done', label: () => 'Done' },
  { id: 'hidden', label: () => 'Hidden' },
]

type Removed = { label: string; task: PlanTask; record?: Task }

export function Checklist() {
  const { state, allTasks, dispatch } = useStore()
  const dated = Boolean(state.profile.date)
  const names = { a: state.profile.partnerAName || 'Partner 1', b: state.profile.partnerBName || 'Partner 2' }
  const [me, setMe] = useMe()
  const [view, setView] = useState<PlanView>('date')
  const effView: PlanView = dated ? view : 'stage'
  const [filter, setFilter] = useState<PlanFilter>('all')
  const [reorder, setReorder] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [removed, setRemoved] = useState<Removed | null>(null)
  const { openSheet, sheet } = useTaskSheet()
  const today = localToday()
  const before = catchUpBefore(state.profile)

  useEffect(() => {
    if (!removed) return
    const t = window.setTimeout(() => setRemoved(null), 10000)
    return () => window.clearTimeout(t)
  }, [removed])

  const visible = useMemo(
    () => allTasks.filter((t) => matchesFilter(t, filter, me, today, before)),
    [allTasks, filter, me, today, before],
  )
  const counts = useMemo(() => {
    const out = {} as Record<PlanFilter, number>
    for (const f of FILTERS) out[f.id] = allTasks.filter((t) => matchesFilter(t, f.id, me, today, before)).length
    return out
  }, [allTasks, me, today, before])

  const editTask = editing ? allTasks.find((t) => t.key === editing) : undefined

  const del = (t: PlanTask) => {
    const record = t.custom ? state.tasks.find((x) => x.key === t.key) : undefined
    dispatch({ type: 'removeTask', key: t.key })
    setRemoved({ label: `“${t.title}” deleted`, task: t, record })
    setEditing(null)
  }
  const undo = () => {
    if (!removed) return
    if (removed.record) dispatch({ type: 'restoreTask', task: removed.record })
    else dispatch({ type: 'editTask', key: removed.task.key, patch: { removed: undefined } })
    setRemoved(null)
  }

  const sections: { id: string; title: string; blurb: string; tasks: PlanTask[]; stage?: string; group?: PlanGroup }[] =
    effView === 'date'
      ? groupTasks(visible, today, before).map(({ group, tasks }) => {
          const g = GROUPS.find((x) => x.id === group)!
          return { id: group, group, title: g.title, blurb: g.blurb, tasks }
        })
      : STAGES.map((s) => ({
          id: s.id,
          stage: s.id,
          title: s.title,
          blurb: s.blurb,
          tasks: sortTasks(
            visible.filter((t) => t.stage === s.id || (s.id === 'details' && !STAGES.some((x) => x.id === t.stage))),
            'stage',
          ),
        })).filter((s) => s.tasks.length)

  return (
    <div className="grid plan">
      <header className="page-head">
        <div className="kicker">{dated ? 'Dated plan' : 'Staged plan'}</div>
        <h1>{dated ? 'Your deadlines' : 'What to do before you have a date'}</h1>
        <p>
          {dated
            ? `Every task is dated back from ${formatShort(state.profile.date)} using typical UK and Northern Ireland lead times. Legal steps follow the notice rules. Change any date to suit you.`
            : 'Until you choose a date, the plan stays in stages so you know what to do first. Once you pick a date, every task gets a deadline worked back from it.'}
        </p>
      </header>

      {!dated && (
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
      )}

      <div className="card plan-controls">
        {dated && (
          <div className="seg seg-2" role="radiogroup" aria-label="Arrange the plan">
            {(['date', 'stage'] as PlanView[]).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                className={`seg-btn${view === v ? ' on' : ''}`}
                onClick={() => {
                  setView(v)
                  setReorder(null)
                }}
              >
                {v === 'date' ? 'By date' : 'By stage'}
              </button>
            ))}
          </div>
        )}
        <div className="chips scroll" role="group" aria-label="Filter tasks">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip${filter === f.id ? ' on' : ''}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label(names, me)} <span className="chip-n">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="me-switch tiny">
          On this phone I'm
          {(['a', 'b'] as const).map((m) => (
            <button key={m} type="button" className={`chip small${me === m ? ' on' : ''}`} aria-pressed={me === m} onClick={() => setMe(m)}>
              {names[m]}
            </button>
          ))}
        </div>
      </div>

      {!sections.length && (
        <div className="card empty">
          <p>
            {filter === 'mine' || filter === 'partner'
              ? 'Nothing assigned yet. Open a task’s Edit to say who’s doing it.'
              : filter === 'overdue'
                ? 'Nothing overdue. Nice.'
                : filter === 'hidden'
                  ? 'No hidden or deleted tasks.'
                  : 'Nothing here yet.'}
          </p>
        </div>
      )}

      {sections.map((sec) => {
        const done = sec.tasks.filter((t) => t.done).length
        const reordering = reorder === sec.id
        const body = (
          <>
            {sec.tasks.map((t, i) => (
              <TaskRow
                key={t.key}
                t={t}
                names={names}
                today={today}
                before={before}
                reordering={reordering}
                canUp={i > 0}
                canDown={i < sec.tasks.length - 1}
                onMove={(dir) => {
                  const m = movePatch(sec.tasks, i, dir, effView)
                  if (m) dispatch({ type: 'editTask', key: m.key, patch: m.patch })
                }}
                onTick={() => (t.done ? dispatch({ type: 'setTaskDone', key: t.key, done: false }) : openSheet(t, 'tick'))}
                onDetails={() => openSheet(t, 'edit')}
                onEdit={() => setEditing(t.key)}
              />
            ))}
          </>
        )
        const canReorder = filter !== 'hidden' && sec.tasks.length > 1 && sec.group !== 'done'
        const head = (
          <div className="plan-group-head">
            {sec.stage && (
              <div className="well">
                <StageIcon stage={sec.stage} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>
                {sec.title}
                {sec.group === 'overdue' && <span className="pill danger" style={{ marginLeft: 8, verticalAlign: "3px" }}>{sec.tasks.length}</span>}
              </h2>
              {sec.blurb && <p style={{ margin: '4px 0 0' }}>{sec.blurb}</p>}
            </div>
            {sec.stage ? (
              <span className="pill">
                {done}/{sec.tasks.length}
              </span>
            ) : sec.group === 'done' ? (
              <span className="pill">{sec.tasks.length}</span>
            ) : null}
          </div>
        )
        if (sec.group === 'done' && filter !== 'done') {
          return (
            <details className={`card plan-group g-done`} key={sec.id}>
              <summary>{head}</summary>
              {body}
            </details>
          )
        }
        return (
          <section className={`card plan-group g-${sec.id}`} key={sec.id} aria-label={sec.title}>
            {head}
            {sec.stage && (
              <div className="progress" style={{ margin: '4px 0 12px' }}>
                <div style={{ width: `${(done / sec.tasks.length) * 100}%` }} />
              </div>
            )}
            {canReorder && (
              <div className="reorder-bar">
                <button type="button" className="td-link" onClick={() => setReorder(reordering ? null : sec.id)}>
                  {reordering ? 'Done reordering' : 'Reorder'}
                </button>
              </div>
            )}
            {body}
          </section>
        )
      })}

      <AddTask names={names} dated={dated} />

      {editTask && (
        <TaskEditSheet
          key={editTask.key}
          task={editTask}
          onClose={() => setEditing(null)}
          onDetails={() => {
            setEditing(null)
            openSheet(editTask, 'edit')
          }}
          onDelete={del}
        />
      )}
      {sheet}
      {removed && (
        <div className="toast" role="status">
          <span>{removed.label}</span>
          <button className="text-btn" type="button" onClick={undo}>
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

function TaskRow({
  t,
  names,
  today,
  before,
  reordering,
  canUp,
  canDown,
  onMove,
  onTick,
  onDetails,
  onEdit,
}: {
  t: PlanTask
  names: { a: string; b: string }
  today: string
  before: string
  reordering: boolean
  canUp: boolean
  canDown: boolean
  onMove: (dir: -1 | 1) => void
  onTick: () => void
  onDetails: () => void
  onEdit: () => void
}) {
  const summaryOf = useDetailSummary()
  const summary = summaryOf(t)
  const id = `task-${t.key}`
  const g = groupOf(t, today, before)
  const who = assigneeName(t.assignee, names)
  const yours = !t.custom && !!t.dueOverride
  return (
    <div className={`row task-row${t.hidden || t.removed ? ' gone' : ''}`}>
      <input id={id} type="checkbox" checked={!!t.done} aria-label={t.done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`} onChange={onTick} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <label htmlFor={id} className="title">
          <strong>{t.title}</strong>
        </label>
        <div className="task-meta tiny">
          {t.dueDate && (
            <span className={g === 'overdue' ? 'due overdue' : 'due'}>
              {g === 'overdue' ? 'Was due' : 'Due'} {formatShort(t.dueDate)}
              {yours && <em> · your date</em>}
            </span>
          )}
          {t.legal && <span className="pill warn">Legal</span>}
          {who && <span className={`who who-${t.assignee}`}>{who}</span>}
          {t.removed ? <span className="pill">Deleted</span> : t.hidden ? <span className="pill">Hidden</span> : null}
        </div>
        {!t.done && t.body && <p className="advice">{t.body}</p>}
        {t.notes && <p className="task-notes">{t.notes}</p>}
        {summary && (
          <div className="td-summary">
            <span>{summary}</span>
          </div>
        )}
        <div className="task-links">
          <button type="button" className="td-link" onClick={onDetails}>
            {summary ? 'Edit details' : 'Add details'}
          </button>
          <button type="button" className="td-link" onClick={onEdit} aria-label={`Edit “${t.title}”`}>
            Edit
          </button>
          {!t.done && t.officialUrl && (
            <a className="td-link" href={t.officialUrl} target="_blank" rel="noreferrer">
              {t.officialLabel || 'Official information'}
            </a>
          )}
        </div>
      </div>
      {reordering && (
        <div className="move-btns">
          <button type="button" className="icon-btn" disabled={!canUp} aria-label={`Move “${t.title}” up`} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" className="icon-btn" disabled={!canDown} aria-label={`Move “${t.title}” down`} onClick={() => onMove(1)}>
            ↓
          </button>
        </div>
      )}
    </div>
  )
}

function AddTask({ names, dated }: { names: { a: string; b: string }; dated: boolean }) {
  const { dispatch } = useStore()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TemplateId>('generic')
  const [due, setDue] = useState('')
  const [who, setWho] = useState<Assignee | ''>('')
  const [stage, setStage] = useState('details')
  const add = () => {
    if (!title.trim()) return
    dispatch({
      type: 'addCustomTask',
      title: title.trim(),
      stage,
      template: kind,
      dueDate: due || undefined,
      assignee: who || undefined,
    })
    setTitle('')
    setDue('')
  }
  return (
    <section className="card add-task">
      <h2>Add your own task</h2>
      <p className="tiny">Pick what kind it is so ticking it off asks the right questions.</p>
      <div className="add-grid">
        <input
          className="span2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="e.g. Ask auntie about family tartan"
          aria-label="New task"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as TemplateId)} aria-label="Kind of task">
          {CUSTOM_TEMPLATE_CHOICES.map((id) => (
            <option key={id} value={id}>
              {TEMPLATES[id].label}
            </option>
          ))}
        </select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label={dated ? 'Due date' : 'Due date (optional)'} />
        <select value={who} onChange={(e) => setWho(e.target.value as Assignee | '')} aria-label="Who's doing it">
          <option value="">Anyone</option>
          <option value="a">{names.a}</option>
          <option value="b">{names.b}</option>
          <option value="both">Both</option>
        </select>
      </div>
      <button className="btn" type="button" onClick={add} disabled={!title.trim()}>
        Add task
      </button>
    </section>
  )
}
